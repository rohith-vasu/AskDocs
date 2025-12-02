from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_serializer
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from . import CRUDManager
from app.models.chat_session_documents import ChatSessionDocument


class ChatSessionDocumentCreate(BaseModel):
    session_id: str = Field(..., description="ID of the chat session")
    document_id: List[str] = Field(..., description="ID of the document to link")


class ChatSessionDocumentUpdate(BaseModel):
    session_id: Optional[str] = Field(None, description="ID of the chat session")
    document_id: Optional[str] = Field(None, description="ID of the document to link")


class DocumentInfo(BaseModel):
    """Nested model for document details."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Document ID")
    filename: str = Field(..., description="Document filename")
    status: str = Field(..., description="Document processing status")
    created_at: datetime = Field(..., description="Document creation timestamp")
    updated_at: datetime = Field(..., description="Document update timestamp")

    @field_serializer("id")
    def serialize_id(self, v: UUID) -> str:
        return str(v)


class ChatSessionDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Unique identifier for the chat-session-document link")
    session_id: UUID = Field(..., description="ID of the chat session")
    document_id: UUID = Field(..., description="ID of the linked document")
    document: Optional[DocumentInfo] = Field(None, description="Document details")
    created_at: datetime = Field(..., description="Timestamp when the link was created")

    @field_serializer("id")
    def serialize_id(self, v: UUID) -> str:
        return str(v)

    @field_serializer("session_id")
    def serialize_session_id(self, v: UUID) -> str:
        return str(v)

    @field_serializer("document_id")
    def serialize_document_id(self, v: UUID) -> str:
        return str(v)


class ChatSessionDocumentHandler(
    CRUDManager[ChatSessionDocument, ChatSessionDocumentCreate, ChatSessionDocumentUpdate, ChatSessionDocumentResponse]
):
    def __init__(self, db: Session):
        super().__init__(db=db, model=ChatSessionDocument, response_schema=ChatSessionDocumentResponse)

    def create(self, obj_in: ChatSessionDocumentCreate) -> List[ChatSessionDocumentResponse]:
        """Add one or more documents to a chat session."""
        session_docs = []
        for doc_id in obj_in.document_id:
            link = ChatSessionDocument(session_id=obj_in.session_id, document_id=doc_id)
            self._db.add(link)
            session_docs.append(link)
        self._db.commit()

        return [self._response_schema.model_validate(link) for link in session_docs]

    def read(self, id: str) -> ChatSessionDocumentResponse:
        return super().read(id)

    def update(self, id: str, obj_in: ChatSessionDocumentUpdate) -> ChatSessionDocumentResponse:
        return super().update(id, obj_in)

    def delete(self, id: str) -> dict:
        return super().delete(id)

    def list_all(self) -> List[ChatSessionDocumentResponse]:
        return super().list_all()

    def get_by_session(self, session_id: str) -> List[ChatSessionDocumentResponse]:
        """Get all documents linked to a chat session."""
        session_docs = (
            self._db.query(ChatSessionDocument)
            .options(joinedload(ChatSessionDocument.document))
            .filter(ChatSessionDocument.session_id == session_id)
            .all()
        )
        return [self._response_schema.model_validate(sd) for sd in session_docs]

    def get_by_document(self, document_id: str) -> List[ChatSessionDocumentResponse]:
        """Get all chat sessions linked to a document."""
        doc_sessions = self._db.query(ChatSessionDocument).filter(ChatSessionDocument.document_id == document_id).all()
        return [self._response_schema.model_validate(ds) for ds in doc_sessions]