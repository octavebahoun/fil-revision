/**
 * Tests anti-IDOR : un second utilisateur ne peut ni lire, ni modifier, ni supprimer,
 * ni rattacher quoi que ce soit aux ressources du premier.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  SUPABASE_URL,
  PUBLISHABLE,
  type TestUser,
} from "../helpers/supabase";
import { createClient } from "@supabase/supabase-js";

let a: TestUser;
let b: TestUser;
const ids: Record<string, string> = {};

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

beforeAll(async () => {
  a = await createTestUser("rls-a");
  b = await createTestUser("rls-b");
  const c = a.client;

  const subject = await c.from("subjects").insert({ name: "Matière A", slug: "matiere-a" }).select().single();
  expect(subject.error).toBeNull();
  ids.subject = subject.data!.id;

  const doc = await c
    .from("documents")
    .insert({
      subject_id: ids.subject,
      title: "Cours A",
      filename: "a.pdf",
      mime: "application/pdf",
      size_bytes: 10,
      sha256: sha("a"),
    })
    .select()
    .single();
  expect(doc.error).toBeNull();
  ids.document = doc.data!.id;

  const page = await c
    .from("document_pages")
    .insert({ document_id: ids.document, page_number: 1, text: "secret A" })
    .select()
    .single();
  expect(page.error).toBeNull();
  ids.page = String(page.data!.id);

  const notion = await c
    .from("notions")
    .insert({
      document_id: ids.document,
      subject_id: ids.subject,
      title: "Notion A",
      pages: [1],
      position: 0,
      source_text: "texte A",
      content_hash: sha("n"),
    })
    .select()
    .single();
  expect(notion.error).toBeNull();
  ids.notion = notion.data!.id;

  const card = await c
    .from("cards")
    .insert({
      notion_id: ids.notion,
      subject_id: ids.subject,
      document_id: ids.document,
      type: "flashcard",
      content: { front: "Q", back: "R" },
    })
    .select()
    .single();
  expect(card.error).toBeNull();
  ids.card = card.data!.id;

  const state = await c.from("card_states").insert({ card_id: ids.card }).select().single();
  expect(state.error).toBeNull();

  ids.session = randomUUID();
  const sess = await c.from("study_sessions").insert({ id: ids.session, mode: "mix" }).select().single();
  expect(sess.error).toBeNull();

  ids.review = randomUUID();
  const rev = await c
    .from("reviews")
    .insert({
      id: ids.review,
      card_id: ids.card,
      session_id: ids.session,
      outcome: "rated",
      rating: 3,
      reviewed_at: new Date().toISOString(),
    })
    .select()
    .single();
  expect(rev.error).toBeNull();

  const park = await c.from("parking").insert({ text: "idée A" }).select().single();
  expect(park.error).toBeNull();
  ids.parking = park.data!.id;

  const job = await c
    .from("jobs")
    .insert({ type: "ingest_document", payload: { documentId: ids.document } })
    .select()
    .single();
  expect(job.error).toBeNull();
  ids.job = job.data!.id;

  const up = await c.storage
    .from("documents")
    .upload(`${a.id}/${sha("a")}.pdf`, new Blob(["%PDF-1.4 test"], { type: "application/pdf" }), {
      contentType: "application/pdf",
    });
  expect(up.error).toBeNull();
});

afterAll(async () => {
  await adminClient()
    .storage.from("documents")
    .remove([`${a?.id}/${sha("a")}.pdf`]);
  await deleteTestUser(a);
  await deleteTestUser(b);
});

const TABLES: Array<[string, string, string]> = [
  ["subjects", "id", "subject"],
  ["documents", "id", "document"],
  ["document_pages", "id", "page"],
  ["notions", "id", "notion"],
  ["cards", "id", "card"],
  ["card_states", "card_id", "card"],
  ["study_sessions", "id", "session"],
  ["reviews", "id", "review"],
  ["parking", "id", "parking"],
  ["jobs", "id", "job"],
];

describe("RLS : isolation entre utilisateurs", () => {
  it.each(TABLES)("B ne lit rien de %s appartenant à A", async (table, col, key) => {
    const { data, error } = await b.client
      .from(table as "subjects")
      .select("*")
      .eq(col as "id", ids[key]!);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(TABLES)("B ne modifie rien de %s appartenant à A", async (table, col, key) => {
    const { data } = await b.client
      .from(table as "parking")
      .update({ user_id: b.id } as never)
      .eq(col as "id", ids[key]!)
      .select();
    expect(data ?? []).toEqual([]);
    const { data: still } = await adminClient()
      .from(table as "parking")
      .select("user_id")
      .eq(col as "id", ids[key]!);
    expect(still?.[0]?.user_id).toBe(a.id);
  });

  it.each(TABLES)("B ne supprime rien de %s appartenant à A", async (table, col, key) => {
    await b.client
      .from(table as "parking")
      .delete()
      .eq(col as "id", ids[key]!);
    const { data } = await adminClient()
      .from(table as "parking")
      .select("user_id")
      .eq(col as "id", ids[key]!);
    expect(data?.length).toBe(1);
  });

  it("B ne peut pas écrire une ligne au nom de A", async () => {
    const { error } = await b.client.from("parking").insert({ text: "usurpation", user_id: a.id });
    expect(error).not.toBeNull();
  });

  it("B ne peut pas rattacher une ressource à celles de A (clés composites)", async () => {
    const r1 = await b.client.from("documents").insert({
      subject_id: ids.subject!,
      title: "x",
      filename: "x.pdf",
      mime: "application/pdf",
      size_bytes: 1,
      sha256: sha("b"),
    });
    expect(r1.error).not.toBeNull();
    const r2 = await b.client.from("card_states").insert({ card_id: ids.card! });
    expect(r2.error).not.toBeNull();
    const r3 = await b.client
      .from("reviews")
      .insert({ id: randomUUID(), card_id: ids.card!, outcome: "absent", reviewed_at: new Date().toISOString() });
    expect(r3.error).not.toBeNull();
  });

  it("B ne voit pas le journal IA de A et personne n'y écrit côté client", async () => {
    await adminClient()
      .from("ai_calls")
      .insert({ user_id: a.id, provider: "mock", model: "m", purpose: "t", ok: true });
    const { data } = await b.client.from("ai_calls").select("*").eq("user_id", a.id);
    expect(data).toEqual([]);
    const ins = await a.client
      .from("ai_calls")
      .insert({ user_id: a.id, provider: "x", model: "x", purpose: "x", ok: true });
    expect(ins.error).not.toBeNull();
  });

  it("anonyme : aucune lecture", async () => {
    const anon = createClient(SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false } });
    for (const [table] of TABLES) {
      const { data } = await anon
        .from(table as "subjects")
        .select("*")
        .limit(1);
      expect(data ?? []).toEqual([]);
    }
  });

  it("les fonctions d'administration sont interdites aux clients", async () => {
    const r1 = await b.client.rpc("admin_set_allowed_emails", { p_emails: ["pirate@example.com"] });
    expect(r1.error).not.toBeNull();
    const r2 = await b.client.rpc("claim_jobs", { p_limit: 10, p_lease_seconds: 60 });
    expect(r2.error).not.toBeNull();
    const r3 = await b.client.rpc("rate_limit_hit", { p_key: "x", p_max: 1, p_window_seconds: 1 });
    expect(r3.error).not.toBeNull();
  });
});

describe("Stockage privé", () => {
  const path = () => `${a.id}/${sha("a")}.pdf`;

  it("B ne peut pas télécharger le fichier de A", async () => {
    const { data, error } = await b.client.storage.from("documents").download(path());
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("B ne peut pas lister le dossier de A", async () => {
    const { data } = await b.client.storage.from("documents").list(a.id);
    expect(data ?? []).toEqual([]);
  });

  it("B ne peut pas déposer dans le dossier de A", async () => {
    const { error } = await b.client.storage
      .from("documents")
      .upload(`${a.id}/intrus.pdf`, new Blob(["%PDF-1.4"], { type: "application/pdf" }), {
        contentType: "application/pdf",
      });
    expect(error).not.toBeNull();
  });

  it("B ne peut pas créer d'URL signée pour le fichier de A", async () => {
    const { data } = await b.client.storage.from("documents").createSignedUrl(path(), 60);
    expect(data?.signedUrl ?? null).toBeNull();
  });

  it("le bucket n'est pas public", async () => {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/documents/${path()}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("A peut lire son propre fichier", async () => {
    const { data, error } = await a.client.storage.from("documents").download(path());
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });
});
