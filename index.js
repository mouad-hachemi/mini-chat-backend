import express from "express";

const PORT = 8080;

const app = express();
app.use(express.json());

app.get("/api/v1/", (req, res) => {
  return res.json({ success: true, message: "Hello, Web" });
});

app.listen(PORT, (error) => {
  console.log(`REST API server currently running at: http://localhost:8080/api/v1`);
});
