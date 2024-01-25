import { MongoClient } from "mongodb";
import config from 'config'

// const url = config.get("DB_URL");
const url = process.env.DB_URL;
const client = new MongoClient(url);
const dbName = "telegraf-bot";

export async function getCollection() {
  await client.connect();
  const db = client.db(dbName);
  return db.collection("dialogs");
}
