import { redirect } from "next/navigation";

export default function NewExpensePage() {
  redirect("/manage/expenses?action=new");
}
