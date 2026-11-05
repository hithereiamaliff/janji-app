import { MAX_RESULTS, searchCities } from "@/availability/city-search";

const cities = [
  { city: "Kolkata", timeZone: "Asia/Kolkata" },
  { city: "Kuala Lumpur", timeZone: "Asia/Kuala_Lumpur" },
  { city: "London", timeZone: "Europe/London" },
  { city: "Mumbai", timeZone: "Asia/Kolkata" },
  { city: "Penang", timeZone: "Asia/Kuala_Lumpur" },
];

describe("searchCities", () => {
  it("finds nothing until something is typed", () => {
    expect(searchCities(cities, "  ")).toEqual([]);
  });

  it("puts cities whose name starts with what was typed first", () => {
    expect(searchCities(cities, "k").map(({ city }) => city)).toEqual([
      "Kolkata",
      "Kuala Lumpur",
      "Mumbai",
      "Penang",
    ]);
  });

  it("then finds it anywhere in a city's name or time zone", () => {
    expect(searchCities(cities, "lumpur").map(({ city }) => city)).toEqual(["Kuala Lumpur", "Penang"]);
    expect(searchCities(cities, "Kolkata").map(({ city }) => city)).toEqual(["Kolkata", "Mumbai"]);
  });

  it("ignores case and spacing around what was typed", () => {
    expect(searchCities(cities, " LONDON ").map(({ city }) => city)).toEqual(["London"]);
  });

  it(`shows at most ${MAX_RESULTS} cities`, () => {
    const many = Array.from({ length: 80 }, (_, index) => ({ city: `Town ${index}`, timeZone: "Etc/UTC" }));

    expect(searchCities(many, "town")).toHaveLength(MAX_RESULTS);
  });
});
