import { anthropic } from "../lib/anthropic.js";
import { env } from "../config/env.js";

export interface CompetencyResult {
  code: "C1" | "C2" | "C3" | "C4" | "C5";
  score: number;
  feedback: string;
}

export interface HighlightResult {
  quote: string;
  competency: "C1" | "C2" | "C3" | "C4" | "C5";
  kind: "ponto_forte" | "ponto_a_melhorar";
  comment: string;
}

export interface CorrectionResult {
  totalScore: number;
  competencies: CompetencyResult[];
  generalFeedback: string;
  highlights: HighlightResult[];
  nextSteps: string[];
  correctedEssay: string;
}

const COMPETENCY_DESCRIPTIONS = `
C1 - Domínio da modalidade escrita formal da língua portuguesa (gramática, ortografia, registro formal).
C2 - Compreensão do tema e aplicação de conceitos de várias áreas de conhecimento para desenvolver o tema dentro da estrutura do texto dissertativo-argumentativo.
C3 - Seleção, relação, organização e interpretação de informações, fatos, opiniões e argumentos em defesa de um ponto de vista.
C4 - Conhecimento dos mecanismos linguísticos necessários para a construção da argumentação (coesão e coerência).
C5 - Proposta de intervenção para o problema abordado, que respeite os direitos humanos, com os 5 elementos: agente, ação, meio/modo, finalidade e detalhamento.
`.trim();

const SUBMIT_CORRECTION_TOOL = {
  name: "submit_correction",
  description: "Envia o resultado da correção da redação no padrão ENEM (5 competências, 0-200 cada).",
  input_schema: {
    type: "object" as const,
    properties: {
      competencies: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            code: { type: "string", enum: ["C1", "C2", "C3", "C4", "C5"] },
            score: { type: "integer", minimum: 0, maximum: 200 },
            feedback: {
              type: "string",
              description: "Justificativa objetiva da nota, citando trechos do texto quando relevante.",
            },
          },
          required: ["code", "score", "feedback"],
        },
      },
      general_feedback: {
        type: "string",
        description: "Comentário geral sobre a redação e principais pontos de melhoria para chegar a 1000.",
      },
      next_steps: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        description:
          "Lista priorizada de ações concretas e específicas (não genéricas) que o aluno deve fazer na próxima redação para se aproximar da nota 1000, da ação de maior impacto para a de menor impacto.",
        items: { type: "string" },
      },
      highlights: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        description:
          "Trechos específicos do texto do aluno a destacar, misturando pontos fortes e pontos a melhorar (o que precisa mudar) de diferentes competências.",
        items: {
          type: "object",
          properties: {
            quote: {
              type: "string",
              description:
                "Trecho copiado EXATAMENTE como aparece no texto do aluno (mesma grafia, pontuação e acentuação, sem resumir ou parafrasear), entre 4 e 20 palavras.",
            },
            competency: { type: "string", enum: ["C1", "C2", "C3", "C4", "C5"] },
            kind: { type: "string", enum: ["ponto_forte", "ponto_a_melhorar"] },
            comment: {
              type: "string",
              description:
                "Comentário curto (1 frase). Para kind='ponto_a_melhorar', diga exatamente o que precisa mudar nesse trecho (ex.: 'crase omitida antes de palavra feminina', 'falta conectivo de oposição aqui'). Para 'ponto_forte', explique por que funciona bem.",
            },
          },
          required: ["quote", "competency", "kind", "comment"],
        },
      },
      corrected_essay: {
        type: "string",
        description:
          "Versão corrigida e reescrita da redação do aluno, em português, pronta para servir de modelo. Preserve a tese, os argumentos e a proposta de intervenção originais do aluno (não invente conteúdo novo nem mude o ponto de vista), mas corrija ortografia, gramática, pontuação e registro formal (C1), melhore a coesão com conectivos e articuladores adequados (C4), reorganize frases quando necessário para deixar os argumentos mais claros e bem encadeados (C3), e complete a proposta de intervenção com os 5 elementos exigidos (agente, ação, meio/modo, finalidade, detalhamento) caso o aluno não os tenha (C5). Mantenha a mesma estrutura de parágrafos (introdução, desenvolvimento, conclusão) e um tamanho semelhante ao texto original.",
      },
    },
    required: ["competencies", "general_feedback", "next_steps", "highlights", "corrected_essay"],
  },
};

export async function correctEssay(params: {
  themeTitle: string;
  themeDescription?: string | null;
  essayText: string;
}): Promise<CorrectionResult> {
  const { themeTitle, themeDescription, essayText } = params;

  const systemPrompt = `Você é um corretor especialista em redações do ENEM, treinado nos critérios oficiais do INEP.
Avalie o texto do aluno seguindo rigorosamente as 5 competências abaixo, cada uma valendo de 0 a 200 pontos (múltiplos de 20 conforme a rubrica oficial do ENEM):

${COMPETENCY_DESCRIPTIONS}

Seja rigoroso e realista, como um corretor oficial do ENEM seria — não infle notas. Sempre justifique cada competência citando problemas ou acertos concretos do texto.

Além da nota por competência, você também deve:
1. Selecionar de 3 a 8 trechos (highlights) do próprio texto do aluno — misturando pontos fortes e pontos a melhorar — e copiá-los EXATAMENTE como estão escritos (mesma grafia e pontuação), para que possam ser localizados e destacados no texto original. Nunca parafraseie o trecho. Nos pontos a melhorar, diga exatamente o que precisa mudar.
2. Listar de 3 a 5 próximos passos concretos e específicos para este aluno chegar a 1000, ordenados do de maior para o de menor impacto na nota (evite dicas genéricas como "revise a gramática" — aponte exatamente o que fazer).
3. Reescrever a redação inteira como uma versão corrigida (corrected_essay), aplicando as correções necessárias em cada uma das 5 competências, sem alterar a tese nem inventar conteúdo que o aluno não escreveu.

Responda chamando a ferramenta submit_correction.`;

  const userPrompt = `Tema da redação: ${themeTitle}
${themeDescription ? `Texto motivador / descrição do tema: ${themeDescription}\n` : ""}
Redação do aluno:
"""
${essayText}
"""`;

  const response = await anthropic.messages.create({
    model: env.anthropicModel,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    tools: [SUBMIT_CORRECTION_TOOL],
    tool_choice: { type: "tool", name: "submit_correction" },
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("Anthropic response was truncated (hit max_tokens) before completing submit_correction");
  }

  const toolUse = response.content.find(
    (block: (typeof response.content)[number]) => block.type === "tool_use",
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Anthropic response did not include a tool_use block for submit_correction");
  }

  const input = toolUse.input as {
    competencies: CompetencyResult[];
    general_feedback: string;
    highlights: HighlightResult[];
    next_steps: string[];
    corrected_essay: string;
  };

  const totalScore = input.competencies.reduce((sum, c) => sum + c.score, 0);

  return {
    totalScore,
    competencies: input.competencies,
    generalFeedback: input.general_feedback,
    highlights: input.highlights ?? [],
    nextSteps: input.next_steps ?? [],
    correctedEssay: input.corrected_essay ?? "",
  };
}
