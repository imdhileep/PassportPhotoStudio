import logging
from functools import lru_cache
from typing import List

from PIL import Image

logger = logging.getLogger(__name__)


class FaceResult:
    def __init__(self, bbox: list[float], confidence: float, embedding: list[float]):
        self.bbox = bbox
        self.confidence = confidence
        self.embedding = embedding


@lru_cache(maxsize=1)
def _load_models():
    try:
        import torch
        from facenet_pytorch import InceptionResnetV1, MTCNN
    except Exception as exc:
        raise RuntimeError("facenet_pytorch or torch not installed") from exc

    device = "cuda" if torch.cuda.is_available() else "cpu"
    mtcnn = MTCNN(keep_all=True, device=device)
    resnet = InceptionResnetV1(pretrained="vggface2").eval().to(device)
    return mtcnn, resnet, device


def detect_faces(image_path: str) -> List[FaceResult]:
    try:
        mtcnn, resnet, device = _load_models()
    except Exception as exc:
        logger.warning("Face AI unavailable: %s", exc)
        return []

    try:
        with Image.open(image_path) as img:
            boxes, probs = mtcnn.detect(img)
            if boxes is None or probs is None:
                return []
            faces = mtcnn.extract(img, boxes, save_path=None)
            if faces is None:
                return []
            embeddings = resnet(faces.to(device)).detach().cpu().numpy()
            results: list[FaceResult] = []
            for idx, box in enumerate(boxes):
                x1, y1, x2, y2 = box.tolist()
                bbox = [x1, y1, x2 - x1, y2 - y1]
                confidence = float(probs[idx])
                embedding = embeddings[idx].tolist()
                results.append(FaceResult(bbox, confidence, embedding))
            return results
    except Exception as exc:
        logger.warning("Face detection failed: %s", exc)
        return []
