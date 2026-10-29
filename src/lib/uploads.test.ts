import { describe, expect, it } from "vitest";
import { UPLOAD_ACCEPT, UPLOAD_MIME_TYPES, isCameraRaw } from "./uploads";

describe("upload rules", () => {
  it("recognises a Canon RAW by its name, whatever the case, or by its type", () => {
    expect(isCameraRaw({ name: "IMG_6310.CR3", type: "" })).toBe(true);
    expect(isCameraRaw({ name: "img_0096.cr2", type: "" })).toBe(true);
    expect(isCameraRaw({ name: "download", type: "image/x-canon-cr3" })).toBe(true);
    expect(isCameraRaw({ name: "peonies.jpg", type: "image/jpeg" })).toBe(false);
    expect(isCameraRaw({ name: "notes.cr3.txt", type: "text/plain" })).toBe(false);
  });

  it("offers RAW in the file picker but never on the server's allow-list", () => {
    expect(UPLOAD_ACCEPT.split(",")).toEqual(expect.arrayContaining([...UPLOAD_MIME_TYPES, ".cr3", ".cr2"]));
    expect(UPLOAD_MIME_TYPES.some((type) => /canon|cr[23]/i.test(type))).toBe(false);
  });
});
