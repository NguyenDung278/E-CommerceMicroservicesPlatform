// Kịch bản chứng minh không oversell: nhiều VU cùng bắn POST /api/v1/orders
// vào MỘT sản phẩm có stock nhỏ. Kỳ vọng: số đơn tạo thành công đúng bằng
// stock ban đầu, phần còn lại bị từ chối vì hết hàng (lỗi nghiệp vụ 4xx),
// tuyệt đối không có 5xx bất thường.
//
// Chạy qua tests/load/run_oversell.sh để được seed sản phẩm + verify DB tự động.
//
// Env:
//   BASE_URL    gateway (mặc định http://localhost:8080)
//   PRODUCT_ID  bắt buộc — sản phẩm dùng để bắn
//   STOCK       stock ban đầu của sản phẩm (mặc định 10)
//   VUS         số virtual user đồng thời (mặc định 50)
//   ITERATIONS  tổng số lần thử checkout (mặc định 200)

import http from 'k6/http';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const PRODUCT_ID = __ENV.PRODUCT_ID;
const STOCK = parseInt(__ENV.STOCK || '10', 10);

export const options = {
  scenarios: {
    checkout_rush: {
      executor: 'shared-iterations',
      vus: parseInt(__ENV.VUS || '50', 10),
      iterations: parseInt(__ENV.ITERATIONS || '200', 10),
      maxDuration: '3m',
    },
  },
  thresholds: {
    // Trái tim của bài test: đúng STOCK đơn thành công, không hơn không kém.
    successful_orders: [`count==${STOCK}`],
    unexpected_errors: ['count==0'],
  },
};

const successfulOrders = new Counter('successful_orders');
const insufficientStockRejections = new Counter('insufficient_stock_rejections');
const rateLimitedRequests = new Counter('rate_limited_requests');
const unexpectedErrors = new Counter('unexpected_errors');

export function setup() {
  if (!PRODUCT_ID) {
    throw new Error('PRODUCT_ID env is required (dùng run_oversell.sh để seed tự động)');
  }

  const email = `oversell-${Date.now()}@loadtest.local`;
  const res = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({
      email,
      password: 'LoadTest123!',
      first_name: 'Load',
      last_name: 'Test',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  let token;
  try {
    const body = res.json();
    token = (body && body.data && body.data.token) || (body && body.token);
  } catch (e) {
    token = undefined;
  }
  if (!token) {
    throw new Error(`register did not return a token: ${res.status} ${res.body}`);
  }
  return { token };
}

export default function (data) {
  const res = http.post(
    `${BASE_URL}/api/v1/orders`,
    JSON.stringify({
      items: [{ product_id: PRODUCT_ID, quantity: 1 }],
      shipping_method: 'pickup',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.token}`,
        'Idempotency-Key': `oversell-${__VU}-${__ITER}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
      },
    },
  );

  if (res.status === 201 || res.status === 200) {
    successfulOrders.add(1);
    return;
  }
  if (res.status === 429) {
    rateLimitedRequests.add(1);
    return;
  }

  const text = (res.body || '').toString().toLowerCase();
  if (res.status >= 400 && res.status < 500 && text.includes('stock')) {
    insufficientStockRejections.add(1);
    return;
  }

  unexpectedErrors.add(1);
  console.error(`unexpected response ${res.status}: ${res.body}`);
}
