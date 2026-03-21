import { program } from "commander";
import { registerServerCommand } from "./commands/server.js";
import { registerServerInitCommand } from "./commands/server-init.js";
import { registerPostCommand } from "./commands/post.js";

program.name("tmms").description("Tmux Markdown Mailer System").version("0.1.0");

const serverCmd = program.command("server").description("Server commands");
registerServerCommand(serverCmd);
registerServerInitCommand(serverCmd);

registerPostCommand(program);

program.parse(process.argv);
