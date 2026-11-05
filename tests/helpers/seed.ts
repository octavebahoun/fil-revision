/** Jeu de cartes minimal pour un utilisateur de test (sans passer par l'IA). */
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function seedDeck(db: SupabaseClient, userId: string, opts: { notions?: number } = {}) {
  const tag = randomUUID().slice(0, 6);
  const { data: subject } = await db
    .from("subjects")
    .insert({ user_id: userId, name: `Bases de données ${tag}`, slug: `bdd-${tag}` })
    .select("id")
    .single();
  const { data: doc } = await db
    .from("documents")
    .insert({
      user_id: userId,
      subject_id: subject!.id,
      title: "Cours BDD",
      filename: "bdd.pdf",
      mime: "application/pdf",
      size_bytes: 100,
      sha256: sha(tag),
      status: "ready",
    })
    .select("id")
    .single();
  await db.from("document_pages").insert(
    [1, 2, 3].map((n) => ({
      user_id: userId,
      document_id: doc!.id,
      page_number: n,
      text: `Page ${n} : une clé primaire identifie chaque ligne.`,
    })),
  );
  const notions: string[] = [];
  const cards: { id: string; type: string; notionId: string }[] = [];
  for (let i = 0; i < (opts.notions ?? 3); i++) {
    const { data: n } = await db
      .from("notions")
      .insert({
        user_id: userId,
        document_id: doc!.id,
        subject_id: subject!.id,
        title: `Notion ${i + 1}`,
        pages: [1],
        position: i,
        source_text: "[p. 1]\ntexte",
        content_hash: sha(`${tag}${i}`),
        status: "ready",
      })
      .select("id")
      .single();
    notions.push(n!.id);
    const rows = [
      {
        type: "fiche",
        content: {
          title: `Notion ${i + 1}`,
          explanation: `Explication ${i + 1} : une clé primaire identifie chaque ligne.`,
          example: "Le numéro étudiant.",
          question: "Que garantit-elle ?",
          answer: "L'unicité.",
          more: "",
        },
      },
      { type: "flashcard", content: { front: `Question ${i + 1} ?`, back: `Réponse ${i + 1}` } },
      {
        type: "vrai_faux",
        content: { statement: `Affirmation ${i + 1}`, answer: true, explanation: "C'est dans le cours." },
      },
      {
        type: "qcm",
        content: {
          question: `QCM ${i + 1} ?`,
          choices: ["Bonne", "Mauvaise A", "Mauvaise B"],
          answerIndex: 0,
          explanation: "La première.",
        },
      },
    ];
    for (const [p, r] of rows.entries()) {
      const { data: c } = await db
        .from("cards")
        .insert({
          user_id: userId,
          notion_id: n!.id,
          subject_id: subject!.id,
          document_id: doc!.id,
          type: r.type,
          content: r.content,
          source_pages: [1],
          source_quote: "une clé primaire identifie chaque ligne",
          verified: true,
          position: p,
        })
        .select("id")
        .single();
      cards.push({ id: c!.id, type: r.type, notionId: n!.id });
    }
  }
  return { subjectId: subject!.id as string, documentId: doc!.id as string, notions, cards };
}
