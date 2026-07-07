import { requireUser } from "@/lib/auth";
import { addItem } from "@/lib/actions";
import { CATEGORIES } from "@/lib/types";
import { Flash } from "@/components/flash";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; title?: string; category?: string; description?: string }>;
}) {
  await requireUser();
  const { error, title = "", category = "", description = "" } = await searchParams;

  return (
    <>
      <h1>Put something up</h1>
      <p className="muted">
        Anything you own and would happily lend. You always decide who gets it and when it comes
        back.
      </p>
      <Flash error={error} />
      <form action={addItem}>
        <label htmlFor="title">What is it?</label>
        <input id="title" name="title" type="text" required defaultValue={title} placeholder="Bosch cordless drill" />

        <label htmlFor="category">Category</label>
        <select id="category" name="category" defaultValue={category || "other"} style={{ width: "auto" }}>
          {CATEGORIES.map(([slug, label]) => (
            <option key={slug} value={slug}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="description">
          Description <span className="hint">— condition, edition, what it&rsquo;s good for</span>
        </label>
        <textarea id="description" name="description" defaultValue={description} />

        <label htmlFor="care_notes">
          Care notes <span className="hint">— optional, e.g. &ldquo;hand-wash only&rdquo;, &ldquo;bring your own bits&rdquo;</span>
        </label>
        <input id="care_notes" name="care_notes" type="text" />

        <label htmlFor="lend_days">
          Return window in days <span className="hint">— leave blank for &ldquo;whenever&rdquo;; borrowers get reminders as the date nears</span>
        </label>
        <input id="lend_days" name="lend_days" type="number" min={1} max={365} placeholder="30" style={{ maxWidth: "8rem" }} />

        <label>Who can borrow it?</label>
        <p className="small" style={{ margin: "0.2rem 0" }}>
          <label style={{ display: "inline", fontWeight: 400 }}>
            <input type="radio" name="visibility" value="friends" defaultChecked /> Friends &amp;
            crews only
          </label>
        </p>
        <p className="small" style={{ margin: "0.2rem 0" }}>
          <label style={{ display: "inline", fontWeight: 400 }}>
            <input type="radio" name="visibility" value="neighbors" /> Also neighbors — people in
            my neighborhood &amp; city circles
          </label>
        </p>

        <p style={{ marginTop: "1.2rem" }}>
          <button type="submit">Add to my shelf</button>
        </p>
      </form>
    </>
  );
}
