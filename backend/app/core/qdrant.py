from qdrant_client import QdrantClient
from qdrant_client.http import models
from typing import Dict, List, Optional
from pathlib import Path
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_qdrant import FastEmbedSparse, QdrantVectorStore, RetrievalMode
from loguru import logger
from cachetools import TTLCache

from app.core.settings import settings

class Qdrant:
    def __init__(self):
        self.client = QdrantClient(
            url=settings.qdrant.url,
        )
        self.dense_embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        self.sparse_embeddings = FastEmbedSparse(model_name="Qdrant/bm25")
        self.search_limit = settings.qdrant.search_limit
        self.scroll_limit = settings.qdrant.scroll_limit
        self._vectorstore_cache = TTLCache(maxsize=100, ttl=3600)
    
    # def _get_dense_embedding(self, text: str) -> List[float]:
    #     """Get dense embedding for text"""
    #     return self.dense_embeddings.embed_query(text)

    # def _get_bm25_embedding(self, text: str) -> List[float]:
    #     """Get bm25 embedding for text"""
    #     return self.sparse_embeddings.embed_query(text)

    def _get_vector_store(self, collection_name: str):
        """Get vector store for collection"""
        if collection_name in self._vectorstore_cache:
            return self._vectorstore_cache[collection_name]

        vectorstore = QdrantVectorStore(
            client=self.client,
            collection_name=collection_name,
            embedding=self.dense_embeddings,
            sparse_embedding=self.sparse_embeddings,
            retrieval_mode=RetrievalMode.HYBRID,
            vector_name="dense",
            sparse_vector_name="sparse",
        )
        self._vectorstore_cache[collection_name] = vectorstore
        return vectorstore

    def _ensure_collection(self, collection_name: str):
        """Ensure the specified collection exists"""
        try:
            self.client.get_collection(collection_name)
        except:
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config={
                    "dense": models.VectorParams(
                        size=384,
                        distance=models.Distance.COSINE
                    ),
                },
                sparse_vectors_config={
                    "sparse": models.SparseVectorParams(index=models.SparseIndexParams(on_disk=False))
                },
                on_disk_payload=True
            )

    def add_document(self, text_chunks: List[Document], collection_name: str, file_path: str):
        """Add a single chunk to the collection."""
        self._ensure_collection(collection_name)

        documents = []
        for chunk in text_chunks:
            # Merge existing metadata with new metadata
            doc_metadata = chunk.metadata.copy()
            doc_metadata.update({
                "source": Path(file_path).name,
                "user_id": collection_name,
            })
            
            document = Document(
                page_content=chunk.page_content,
                metadata=doc_metadata
            )
            documents.append(document)

        if not documents:
            logger.warning(f"No documents generated for {file_path}, skipping Qdrant upsert")
            return

        vector_store = self._get_vector_store(collection_name)
        vector_store.add_documents(documents)

        logger.info(f"Upserted {len(documents)} points for {file_path}")

    def delete_document(self, doc_name: str, collection_name: str):
        """Delete document from Qdrant"""
        filter_to_delete = models.Filter(
            must=[
                models.FieldCondition(
                    key="metadata.source",
                    match=models.MatchValue(value=doc_name)
                )
            ]
        )

        response = self.client.delete(
            collection_name=collection_name,
            points_selector=models.FilterSelector(filter=filter_to_delete)
        )

        logger.info(f"Deletion response: {response}")

    def delete_collection(self, collection_name: str):
        """Delete collection from Qdrant"""
        self.client.delete_collection(collection_name=collection_name)

    def search(
        self,
        query: str,
        collection_name: Optional[str] = None,
        documents: List[str] = None,
        limit: Optional[int] = None
    ) -> List[str]:
        """Perform semantic search on chat history or database documents"""
        if limit is None:
            limit = self.search_limit
        
        vector_store = self._get_vector_store(collection_name=collection_name)

        results = vector_store.similarity_search(
            query=query,
            k=limit,
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="metadata.source",
                        match=models.MatchAny(
                            any=documents
                        ),
                    ),
                ]
            ),
        )
        
        return [hit.page_content for hit in results]


# -----------------------------
# ✅ Singleton instance helper
# -----------------------------

_qdrant_client: Optional[Qdrant] = None

def get_qdrant_client() -> Qdrant:
    """
    Lazily initialize and return a single global Qdrant instance.
    Ensures embeddings and client are loaded only once.
    """
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = Qdrant()
        logger.info("Initialized global Qdrant client")
    return _qdrant_client