import { compress } from "@/lib/meeqo/image";

export type OutFile = { name: string; type: string; data: string };

/** Turns a picked file into what the chat endpoints take: images shrunk to JPEG, PDFs as they are (about 2 MB at most). */
export async function readAttachment(file: File): Promise<OutFile> {
  let type = file.type;
  let dataUrl: string;
  if (type === "application/pdf") {
    if (file.size > 2_000_000) throw new Error("Die Datei ist zu groß. Höchstens etwa 2 MB.");
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
      reader.readAsDataURL(file);
    });
  } else if (type.startsWith("image/")) {
    dataUrl = await compress(file);
    type = "image/jpeg";
  } else {
    throw new Error("Nur Bilder und PDF-Dateien.");
  }
  const name = type === "image/jpeg" ? file.name.replace(/\.\w+$/, "") + ".jpg" : file.name;
  return { name, type, data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}
