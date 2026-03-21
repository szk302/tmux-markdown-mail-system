import { homedir } from "os";
import { join } from "path";
import { DEFAULT_POLLING_INTERVAL } from "../shared/constants.js";

export const DEFAULT_DEAD_LETTER_DIR = join(homedir(), ".local", "share", "tmms", "dead_letter");

export const DEFAULT_CONFIG_TEMPLATE = `# TMMS Server Configuration

# Polling interval in seconds
polling_interval: ${DEFAULT_POLLING_INTERVAL}

# Directory for messages with unknown recipients
dead_letter_dir: ${DEFAULT_DEAD_LETTER_DIR}
`;
