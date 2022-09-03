import express from "express";
import v1 from "./v1";

export default function Router() {
	const router = express.Router();
	router.use("/api/v1/", v1());

	return router;
}
