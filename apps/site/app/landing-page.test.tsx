import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LandingPage } from "./landing-page";

describe("LandingPage", () => {
  it("switches between the product preview tabs", async () => {
    const user = userEvent.setup();
    render(<LandingPage appPocUrl={null} />);

    expect(screen.getByText("다시 이어볼 기록")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "기록 목록" }));
    expect(screen.getByText("내 기록 18개")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "인사이트" }));
    expect(screen.getByText("기록이 보여주는 취향")).toBeInTheDocument();
  });

  it("keeps the app CTA disabled until a POC URL is configured", () => {
    render(<LandingPage appPocUrl={null} />);

    expect(screen.getAllByText("앱 POC 준비 중")).toHaveLength(2);
    expect(
      screen.queryByRole("link", { name: /내 브라우저에서 직접 시험하기/ }),
    ).not.toBeInTheDocument();
  });

  it("links both app CTAs to the configured private preview", () => {
    render(<LandingPage appPocUrl="https://private.example/" />);

    expect(
      screen.getByRole("link", { name: /내 브라우저에서 직접 시험하기/ }),
    ).toHaveAttribute("href", "https://private.example/");
    expect(
      screen.getByRole("link", { name: /게스트 앱 POC 열기/ }),
    ).toHaveAttribute("href", "https://private.example/");
  });
});
