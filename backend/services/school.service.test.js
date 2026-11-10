const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateLessonEditorDocument } = require('./school.service');

function documentWithTextStyle(attrs) {
  return {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'Nội dung',
        marks: [{ type: 'textStyle', attrs }],
      }],
    }],
  };
}

test('lesson editor preserves safe CSS styles from pasted rich text', () => {
  const document = documentWithTextStyle({
    color: 'color(display-p3 0.2 0.4 0.8)',
    backgroundColor: 'color-mix(in srgb, #fff 80%, #000)',
    fontSize: 'calc(1rem + 2px)',
    fontFamily: '"Google Sans", Arial, sans-serif',
  });
  assert.deepEqual(validateLessonEditorDocument(document), document);
});

test('lesson editor rejects CSS style values that can escape their declaration', () => {
  for (const [attribute, value] of [
    ['color', 'red; background-image: url(https://example.invalid/x)'],
    ['backgroundColor', 'red; color: blue'],
    ['fontSize', '16px; position: fixed'],
    ['fontFamily', 'Arial } body { display: none'],
  ]) {
    assert.throws(
      () => validateLessonEditorDocument(documentWithTextStyle({ [attribute]: value })),
      (error) => error.code === 'SCHOOL_INVALID_LESSON_DOCUMENT',
    );
  }
});

test('lesson editor accepts images belonging to the published resource being edited', () => {
  const resourceId = '30000000-0000-4000-8000-000000000001';
  const assetId = '40000000-0000-4000-8000-000000000001';
  const document = {
    type: 'doc',
    content: [{
      type: 'image',
      attrs: {
        src: `/api/resources/${resourceId}/assets/${assetId}`,
        alt: 'Hình minh họa',
      },
    }],
  };

  assert.deepEqual(validateLessonEditorDocument(document, { resourceId }), document);
  assert.throws(
    () => validateLessonEditorDocument(document, { resourceId: '30000000-0000-4000-8000-000000000002' }),
    (error) => error.code === 'SCHOOL_INVALID_LESSON_DOCUMENT',
  );
});
