export type DocumentKind = "image" | "pdf" | "other";

export function detectDocumentKind(fileName: string | null, fileUrl: string | null): DocumentKind {
  const name = (fileName ?? "").toLowerCase();
  const url = (fileUrl ?? "").toLowerCase().split("?")[0] ?? "";

  const extFromName = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  const imageExt = /^(jpe?g|png|gif|webp|heic|bmp|svg)$/;
  if (imageExt.test(extFromName) || /\.(jpe?g|png|gif|webp|heic)(\/)?$/.test(url)) {
    return "image";
  }
  if (extFromName === "pdf" || url.endsWith(".pdf")) {
    return "pdf";
  }
  return "other";
}
