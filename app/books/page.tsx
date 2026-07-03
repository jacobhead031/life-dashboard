import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BooksContent } from "./BooksContent";

export default async function BooksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: books } = await supabase
    .from("book")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div className="wrap">
      <div className="detail-header">
        <Link href="/" className="back-link">← home</Link>
        <h1 className="detail-title">Books</h1>
      </div>
      <BooksContent books={books ?? []} />
    </div>
  );
}
