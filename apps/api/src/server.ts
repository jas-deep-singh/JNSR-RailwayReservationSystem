import "dotenv/config";
import app from "./app";

const PORT = Number(process.env.API_PORT) || 5000;

app.listen(PORT, () => {
  console.log(`JNSR Railway API running on port ${PORT}`);
});