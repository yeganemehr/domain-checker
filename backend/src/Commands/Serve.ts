import { Command } from 'commander';
import { container } from 'tsyringe';
import Database from '../Database';
import { setupConfig, setupLogger } from '../Helpers/SetupHelpers';
import HttpServer from '../HttpServer';
import Scanner from '../Scanner';


const command = new Command('serve');

command.description('Run a http server');
command.action(async () => {
	await setupConfig();
	setupLogger();
	const database = container.resolve(Database);
	await database.load();

	const scanner = container.resolve(Scanner);
	try {
		scanner.start();
	} catch (e) { }

	const server = container.resolve(HttpServer);
	server.run();

});

export default command;
