import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

/* ---------------------------------------------------------
   Thin wrappers around Firestore. Reads that the UI needs
   live are onSnapshot listeners returning an unsubscribe fn;
   everything else is one-shot. Every list-style query here is
   pre-filtered to match what firestore.rules allows a client
   in that role to list without a status/owner filter — Firestore
   rejects a whole query if any possible result could fail the
   read rule, so "give me everything" only works for admins.
--------------------------------------------------------- */

// ---------------- users ----------------
export async function upsertUserProfile(fbUser) {
  const ref = doc(db, "users", fbUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      name: fbUser.displayName || fbUser.email,
      email: fbUser.email,
      photoURL: fbUser.photoURL || null,
      role: "user",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      name: fbUser.displayName || fbUser.email,
      email: fbUser.email,
      photoURL: fbUser.photoURL || null,
      updatedAt: serverTimestamp(),
    });
  }
}

export function listenUserProfile(uid, cb) {
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (err) => {
      console.error("listenUserProfile", err);
      cb(null);
    }
  );
}

export async function setUserRole(uid, role) {
  await updateDoc(doc(db, "users", uid), { role, updatedAt: serverTimestamp() });
}

export async function setUserPaymentInfo(uid, { upiId, paymentContact }) {
  await updateDoc(doc(db, "users", uid), { upiId, paymentContact, updatedAt: serverTimestamp() });
}

export async function findUserByEmail(email) {
  const q = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

// ---------------- generic admin-managed collections ----------------
// events, leaderboard entries and rulebook all follow the same
// public-read / admin-write shape, so one set of helpers covers all three.
function listenCollection(name, cb) {
  return onSnapshot(
    collection(db, name),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error(`listen ${name}`, err);
      cb([]);
    }
  );
}

export const listenEvents = (cb) => listenCollection("events", cb);
export const createEvent = (data) =>
  addDoc(collection(db, "events"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
export const updateEvent = (id, data) =>
  updateDoc(doc(db, "events", id), { ...data, updatedAt: serverTimestamp() });
export const deleteEvent = (id) => deleteDoc(doc(db, "events", id));

export const listenLeaderboard = (cb) => listenCollection("leaderboard", cb);
export const createLeaderboardEntry = (data) =>
  addDoc(collection(db, "leaderboard"), { ...data, updatedAt: serverTimestamp() });
export const updateLeaderboardEntry = (id, data) =>
  updateDoc(doc(db, "leaderboard", id), { ...data, updatedAt: serverTimestamp() });
export const deleteLeaderboardEntry = (id) => deleteDoc(doc(db, "leaderboard", id));

export function listenRulebook(cb) {
  return onSnapshot(
    doc(db, "rulebook", "content"),
    (snap) => cb(snap.exists() ? snap.data().text : ""),
    (err) => {
      console.error("listenRulebook", err);
      cb("");
    }
  );
}
export async function setRulebook(text, updatedBy) {
  await setDoc(doc(db, "rulebook", "content"), { text, updatedAt: serverTimestamp(), updatedBy });
}

// ---------------- products ----------------
export function listenApprovedProducts(cb) {
  const q = query(collection(db, "products"), where("status", "==", "approved"));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenApprovedProducts", err);
      cb([]);
    }
  );
}
export function listenSellerProducts(uid, cb) {
  const q = query(collection(db, "products"), where("sellerId", "==", uid));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenSellerProducts", err);
      cb([]);
    }
  );
}
// admin-only: the rule's isAdmin() check doesn't depend on resource data,
// so an unfiltered list is allowed only for them.
export function listenAllProducts(cb) {
  return listenCollection("products", cb);
}
export const createProduct = (data) =>
  addDoc(collection(db, "products"), {
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
export const decideProduct = (id, status) =>
  updateDoc(doc(db, "products", id), { status, updatedAt: serverTimestamp() });

// ---------------- orders ----------------
// One order per seller per checkout — payment is a manual per-seller
// handoff, so the buyer needs each seller's payment info separately.
export async function createOrdersForCart(cart, buyer) {
  const bySeller = new Map();
  for (const item of cart) {
    const key = item.sellerId;
    if (!bySeller.has(key)) bySeller.set(key, { sellerId: key, sellerName: item.sellerName, items: [] });
    bySeller.get(key).items.push({
      productId: item.id,
      name: item.name,
      price: item.price,
      qty: item.qty,
    });
  }
  const orders = [];
  for (const group of bySeller.values()) {
    const sellerSnap = await getDoc(doc(db, "users", group.sellerId));
    const sellerProfile = sellerSnap.exists() ? sellerSnap.data() : {};
    const sellerUpiId = sellerProfile.upiId || null;
    const sellerPaymentContact = sellerProfile.paymentContact || null;
    const total = group.items.reduce((s, i) => s + i.price * i.qty, 0);
    const ref = await addDoc(collection(db, "orders"), {
      buyerId: buyer.uid,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      sellerId: group.sellerId,
      sellerName: group.sellerName,
      sellerIds: [group.sellerId],
      sellerUpiId,
      sellerPaymentContact,
      items: group.items,
      total,
      status: "pending_payment",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    orders.push({
      id: ref.id,
      sellerId: group.sellerId,
      sellerName: group.sellerName,
      sellerUpiId,
      sellerPaymentContact,
      total,
    });
  }
  return orders;
}

export function listenMyOrders(uid, cb) {
  const q = query(collection(db, "orders"), where("buyerId", "==", uid));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenMyOrders", err);
      cb([]);
    }
  );
}
export function listenSellerOrders(uid, cb) {
  const q = query(collection(db, "orders"), where("sellerIds", "array-contains", uid));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenSellerOrders", err);
      cb([]);
    }
  );
}
export const setOrderStatus = (id, status) =>
  updateDoc(doc(db, "orders", id), { status, updatedAt: serverTimestamp() });
