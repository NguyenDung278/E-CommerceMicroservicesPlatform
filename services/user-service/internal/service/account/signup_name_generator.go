package account

import (
	cryptorand "crypto/rand"
	"math/big"
)

var signupRandomFirstNames = []string{
	"An",
	"Binh",
	"Chi",
	"Dung",
	"Giang",
	"Hanh",
	"Khanh",
	"Linh",
	"Minh",
	"Nam",
	"Ngoc",
	"Nhan",
	"Phuong",
	"Quynh",
	"Son",
	"Thao",
	"Trang",
	"Tuan",
	"Vy",
}

var signupRandomLastNames = []string{
	"Bui",
	"Dao",
	"Dang",
	"Dinh",
	"Do",
	"Duong",
	"Ho",
	"Hoang",
	"Le",
	"Ly",
	"Ngo",
	"Nguyen",
	"Pham",
	"Phan",
	"Tran",
	"Trinh",
	"Truong",
	"Vu",
}

func generateRandomSignupName() (string, string) {
	firstName := signupRandomFirstNames[randomSignupIndex(len(signupRandomFirstNames), 17)]
	lastName := signupRandomLastNames[randomSignupIndex(len(signupRandomLastNames), 53)]
	return firstName, lastName
}

func randomSignupIndex(limit int, fallbackSalt int64) int {
	if limit <= 1 {
		return 0
	}

	value, err := cryptorand.Int(cryptorand.Reader, big.NewInt(int64(limit)))
	if err == nil {
		return int(value.Int64())
	}

	now := currentTime().UnixNano() + fallbackSalt
	if now < 0 {
		now = -now
	}

	return int(now % int64(limit))
}
