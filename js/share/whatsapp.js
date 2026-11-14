// WhatsApp helpers. Israeli numbers: 05x… → 9725x…
export function normPhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "972" + d.slice(1);
  return d;
}

/** No phone → wa.me/?text= opens the contact picker. */
export function waUrl(text, phone) {
  const p = normPhone(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}
