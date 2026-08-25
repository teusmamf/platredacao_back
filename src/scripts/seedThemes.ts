import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const themes = [
  {
    title: "Desafios da mobilidade urbana no Brasil",
    description:
      "Discuta os principais desafios para garantir mobilidade urbana eficiente e inclusiva nas grandes cidades brasileiras.",
    motivational_texts: [
      "Texto I: dados do IBGE sobre tempo médio de deslocamento nas capitais.",
      "Texto II: reportagem sobre a expansão de ciclovias e transporte coletivo.",
    ],
  },
  {
    title: "Saúde mental dos jovens na era digital",
    description:
      "Discuta os impactos do uso excessivo de redes sociais na saúde mental de adolescentes e possíveis caminhos de enfrentamento.",
    motivational_texts: ["Texto I: pesquisa sobre uso de telas e ansiedade em adolescentes."],
  },
  {
    title: "Desinformação e o desafio do debate público",
    description:
      "Discuta o combate à desinformação (fake news) como condição para o fortalecimento do debate público no Brasil.",
    motivational_texts: ["Texto I: dados sobre disseminação de notícias falsas em redes sociais."],
  },
];

async function main() {
  const { error } = await supabaseAdmin.from("essay_themes").insert(themes);
  if (error) {
    console.error("Failed to seed themes", error);
    process.exit(1);
  }
  console.log(`Seeded ${themes.length} essay themes.`);
}

main();
