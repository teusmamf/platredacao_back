import { anthropic } from "../lib/anthropic.js";
import { env } from "../config/env.js";

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function transcribeHandwrittenEssay(params: {
  buffer: Buffer;
  mimeType: string;
}): Promise<string> {
  const { buffer, mimeType } = params;

  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    throw new Error(
      `Unsupported image type: ${mimeType}. Send a photo as JPEG, PNG, WEBP or GIF (convert PDF pages to image before upload).`
    );
  }

  const response = await anthropic.messages.create({
    model: env.anthropicModel,
    max_tokens: 4096,
    system:
      "Você transcreve redações manuscritas em português do Brasil com máxima fidelidade. " +
      "Preserve a ortografia original do aluno, incluindo erros de grafia e pontuação — não corrija nada. " +
      "Não adicione comentários, títulos ou observações: responda apenas com o texto transcrito, mantendo os parágrafos.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: buffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Transcreva fielmente o texto manuscrito desta redação.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find(
    (block: (typeof response.content)[number]) => block.type === "text",
  );
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic response did not include transcribed text");
  }

  return textBlock.text.trim();
}
