import { redirect } from "next/navigation";

// Redirect-only route: there is no UI to show instantly.
export const instant = false;

export default function NewProductPage() {
  redirect("/manage/products?action=new");
}
