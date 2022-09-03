import { program, Option } from 'commander';
import Serve from './Serve';
import { getDefaultConfigPath } from "../Helpers/SetupHelpers";

program.addOption(new Option('-c, --config <file>', 'Path to config file').default(getDefaultConfigPath()));
program.addCommand(Serve);

export default program;
