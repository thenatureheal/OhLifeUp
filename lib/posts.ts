import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type Category = "china" | "coaching";

export interface Post {
  id: string;
  category: Category;
  name: string;
  title: string;
  content: string;
  createdAt: string | null; // ISO string for client display
}

export interface NewPost {
  category: Category;
  name: string;
  title: string;
  content: string;
}

const COLLECTION = "posts";

function toISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

/** List posts of a category, newest first. */
export async function listPosts(category: Category): Promise<Post[]> {
  const q = query(
    collection(db, COLLECTION),
    where("category", "==", category),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      category: data.category,
      name: data.name,
      title: data.title,
      content: data.content,
      createdAt: toISO(data.createdAt),
    };
  });
}

/**
 * Create a post. The `password` field collected in the form is intentionally
 * NOT persisted: the original backend never validated it and the `posts`
 * collection is publicly readable, so storing a plaintext password would leak
 * it. Edit/delete (which would need the password) is out of scope.
 */
export async function createPost(input: NewPost): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    category: input.category,
    name: input.name,
    title: input.title,
    content: input.content,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Fetch a single post by id. */
export async function getPost(id: string): Promise<Post | null> {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    category: data.category,
    name: data.name,
    title: data.title,
    content: data.content,
    createdAt: toISO(data.createdAt),
  };
}
