import sys
import json
import os

os.environ.setdefault('PADDLE_PDX_LOGGING_LEVEL', 'WARNING')
os.environ.setdefault('FLAGS_call_stack_level', '2')


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
        rec_texts = getattr(page_result, 'rec_texts', None) or []
        rec_scores = getattr(page_result, 'rec_scores', None) or []
        rec_boxes = getattr(page_result, 'rec_boxes', None)

        if rec_boxes is not None and len(rec_boxes) == len(rec_texts):
            items = sorted(
                zip(rec_boxes, rec_texts, rec_scores),
                key=lambda x: (x[0][1], x[0][0])
            )
            for _, text, score in items:
                stripped = str(text).strip()
                if stripped:
                    texts.append(stripped)
                    confidences.append(float(score))
        else:
            for text, score in zip(rec_texts, rec_scores):
                stripped = str(text).strip()
                if stripped:
                    texts.append(stripped)
                    confidences.append(float(score))

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
