import { DEFAULT_POLLING_INTERVAL } from "../shared/constants.js";

export const DEFAULT_CONFIG_TEMPLATE = `# TMMS Server Configuration

# Polling interval in seconds
polling_interval: ${DEFAULT_POLLING_INTERVAL}

# Directory for messages with unknown recipients
dead_letter_dir: /path/to/dead_letter
`;
