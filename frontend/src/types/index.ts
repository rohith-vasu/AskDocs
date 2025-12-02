export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface Document {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SessionDocument {
  id: string;
  session_id: string;
  document_id: string;
  document?: Document;
  created_at: string;
}

export interface ChatSession {
  id: string;
  name: string;
  //   created_at: string;
  //   updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatRequest {
  session_id: string;
  query: string;
  document_ids?: string[];
}
