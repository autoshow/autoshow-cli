import sys
import json
import os

os.environ.setdefault('PADDLE_PDX_LOGGING_LEVEL', 'WARNING')
os.environ.setdefault('FLAGS_call_stack_level', '2')
os.environ.setdefault('PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK', 'True')


def get_value(result, key, default):
    if isinstance(result, dict):
        return result.get(key, default)
    return getattr(result, key, default)


def to_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def box_sort_key(box):
    try:
        if hasattr(box, 'tolist'):
            box = box.tolist()

        if (
            isinstance(box, (list, tuple))
            and len(box) > 0
            and isinstance(box[0], (list, tuple))
        ):
            xs = [to_float(point[0]) for point in box if isinstance(point, (list, tuple)) and len(point) > 0]
            ys = [to_float(point[1]) for point in box if isinstance(point, (list, tuple)) and len(point) > 1]
            return (min(ys) if ys else 0.0, min(xs) if xs else 0.0)

        if isinstance(box, (list, tuple)) and len(box) >= 2:
            return (to_float(box[1]), to_float(box[0]))
    except Exception:
        pass

    return (0.0, 0.0)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"text": "", "confidence": 0.0}))
        return

    image_path = sys.argv[1]

    from paddleocr import PaddleOCR

    ocr = PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False
    )

    result = ocr.predict(image_path)

    texts = []
    confidences = []

    for page_result in result:
        rec_texts = get_value(page_result, 'rec_texts', []) or []
        rec_scores = get_value(page_result, 'rec_scores', []) or []
        rec_boxes = get_value(page_result, 'rec_boxes', None)

        if hasattr(rec_texts, 'tolist'):
            rec_texts = rec_texts.tolist()
        if hasattr(rec_scores, 'tolist'):
            rec_scores = rec_scores.tolist()
        if hasattr(rec_boxes, 'tolist'):
            rec_boxes = rec_boxes.tolist()

        if rec_boxes is not None and len(rec_boxes) == len(rec_texts):
            items = sorted(
                zip(rec_boxes, rec_texts, rec_scores),
                key=lambda x: box_sort_key(x[0])
            )
            for _, text, score in items:
                stripped = str(text).strip()
                if stripped:
                    texts.append(stripped)
                    confidences.append(to_float(score))
        else:
            for text, score in zip(rec_texts, rec_scores):
                stripped = str(text).strip()
                if stripped:
                    texts.append(stripped)
                    confidences.append(to_float(score))

    combined_text = '\n'.join(texts)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    output = {
        "text": combined_text,
        "confidence": round(avg_confidence, 4)
    }

    sys.stderr.flush()
    print(json.dumps(output))


if __name__ == '__main__':
    main()
