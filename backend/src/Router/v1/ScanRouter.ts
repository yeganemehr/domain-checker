import express from "express";
import AbstractController from "../../AbstractController";
import ScanController from "../../Controllers/ScanController";

export default function ScanRouter() {
	const router = express.Router();
	router.get(
		"/",
		AbstractController.runController(ScanController, "getStatusHttp")
	);

	router.get(
		"/download",
		AbstractController.runController(ScanController, "download")
	);

	router.post(
		"/start",
		AbstractController.runValidator(ScanController, "startSchemaValidation"),
		AbstractController.runController(ScanController, "start"),
	);

	router.post(
		"/stop",
		AbstractController.runController(ScanController, "stop"),
	);

	return router;
}
