import sharp from "sharp";
import { db, branch, type Manager } from "./db.ts";
import { token } from "./security.ts";
import { AccountError } from "./account.ts";
export async function saveCompanyLogo(
  user: Manager,
  id: string,
  bytes: Buffer,
  mime: string,
) {
  if (user.role !== "admin")
    throw new AccountError(
      "Only administrators can manage company logos.",
      403,
    );
  if (!branch(id)) throw new AccountError("Branch not found.", 404);
  if (bytes.length > 2097152)
    throw new AccountError("Picture must be no larger than 2 MB.", 413);
  if (!["image/png", "image/jpeg"].includes(mime))
    throw new AccountError("Choose a PNG or JPG picture.");
  let image: Buffer;
  try {
    const decoded = sharp(bytes, {
      limitInputPixels: 16000000,
      failOn: "warning",
    });
    const meta = await decoded.metadata();
    if (
      meta.format !== (mime === "image/png" ? "png" : "jpeg") ||
      (meta.pages && meta.pages > 1)
    )
      throw Error();
    image = await decoded
      .rotate()
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    throw new AccountError("Picture is invalid. Choose a PNG or JPG picture.");
  }
  db.prepare(
    "INSERT INTO branch_logos(branch_id,image,version) VALUES (?,?,?) ON CONFLICT(branch_id) DO UPDATE SET image=excluded.image,version=excluded.version",
  ).run(id, image, token());
  return branch(id)!;
}
export function removeCompanyLogo(user: Manager, id: string) {
  if (user.role !== "admin")
    throw new AccountError(
      "Only administrators can manage company logos.",
      403,
    );
  if (!branch(id)) throw new AccountError("Branch not found.", 404);
  db.prepare("DELETE FROM branch_logos WHERE branch_id=?").run(id);
  return branch(id)!;
}
