import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Landing } from "./Landing";

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("Landing", () => {
  it("renders the pitch and links to the studio", async () => {
    const user = userEvent.setup();
    render(<Landing />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /keep the groove/i,
    );

    const studioLinks = screen.getAllByRole("link", { name: /open studio/i });
    expect(studioLinks.length).toBeGreaterThan(0);
    for (const link of studioLinks) {
      expect(link).toHaveAttribute("href", "/studio");
    }

    await user.click(studioLinks[0]);
    expect(window.location.pathname).toBe("/studio");
  });
});
