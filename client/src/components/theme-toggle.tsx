import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "nd-theme";

function readInitialTheme(): Theme {
  if (typeof document !== "undefined") {
    const current = document.documentElement.dataset.theme;
    if (current === "light" || current === "dark") {
      return current;
    }
  }
  return "light";
}

/**
 * Nút chuyển sáng/tối. Theme được resolve sẵn bởi script inline trong
 * index.html (localStorage → hệ điều hành) nên state khởi tạo khớp với
 * màu đang hiển thị, không gây nhấp nháy khi hydrate.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage có thể bị chặn (chế độ riêng tư) — vẫn đổi theme trong phiên
      }
      return next;
    });
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="header-action theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      aria-pressed={isDark}
      title={isDark ? "Giao diện sáng" : "Giao diện tối"}
    >
      {isDark ? <Sun size={21} /> : <Moon size={21} />}
    </button>
  );
}
