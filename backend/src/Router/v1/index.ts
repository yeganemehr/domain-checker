import express from "express";
import ScanRouter from "./ScanRouter";

export default function Router() {
	const router = express.Router();
	router.use("/scan", ScanRouter());

	return router;
}
