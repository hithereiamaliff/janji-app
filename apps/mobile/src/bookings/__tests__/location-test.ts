import { describeLocation, phoneUrl } from "@/bookings/location";

describe("describeLocation", () => {
  it("turns meeting links into links, keeping their host", () => {
    expect(describeLocation("https://Meet.Google.com/abc-defg-hij")).toEqual({
      kind: "link",
      url: "https://meet.google.com/abc-defg-hij",
      host: "meet.google.com",
    });
    expect(describeLocation(" http://zoom.us:80/j/123?pwd=x ")).toEqual({
      kind: "link",
      url: "http://zoom.us/j/123?pwd=x",
      host: "zoom.us",
    });
  });

  it("keeps text that only starts like a link", () => {
    expect(describeLocation("https://not a link")).toEqual({ kind: "text", text: "https://not a link" });
  });

  it("doesn't link other URL schemes", () => {
    expect(describeLocation("javascript:alert(1)")).toEqual({ kind: "text", text: "javascript:alert(1)" });
  });

  it("recognises a conferencing app without a link", () => {
    expect(describeLocation("integrations:daily")).toEqual({ kind: "app" });
  });

  it("recognises phone numbers", () => {
    expect(describeLocation("+60 12-345 6789")).toEqual({ kind: "phone", number: "+60 12-345 6789" });
  });

  it("keeps addresses and other text as they are", () => {
    expect(describeLocation("Level 3, 12 Jalan Ampang, Kuala Lumpur")).toEqual({
      kind: "text",
      text: "Level 3, 12 Jalan Ampang, Kuala Lumpur",
    });
  });
});

describe("phoneUrl", () => {
  it("drops the formatting from the number", () => {
    expect(phoneUrl("+44 (20) 7946-0000")).toBe("tel:+442079460000");
  });
});
