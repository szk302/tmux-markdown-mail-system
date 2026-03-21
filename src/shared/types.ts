export interface PaneInfo {
  paneId: string;
  name: string;
  outbox: string;
  inbox: string;
  notifyCmd: string;
  replyTo?: string;
}

export interface TmmsMetadata {
  tmms_id: string;
  tmms_from: string;
  tmms_to: string;
  tmms_created_at: string;
  tmms_subject?: string;
  tmms_thread_id?: string;
}

export interface ServerConfig {
  polling_interval: number;
  dead_letter_dir: string;
}
