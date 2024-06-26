import React, { useState, useEffect } from 'react';
import { FaRegCheckCircle } from 'react-icons/fa';

const CheckerModify = ({ data, onUpdateData, onBoxClick }) => {
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!data || !data.body) {
      return;
    }

    const extractErrors = (item, errors = []) => {
      // 에러 텍스트를 추출하는 함수
      if (item.type === 'PARAGRAPH' && item.errors) {
        item.errors.forEach(error => {
          errors.push({
            paragraphId: item.id,
            originalText: error.orgStr,
            replacementOptions: error.candWord || [],
            selectedReplacement: error.candWord && error.candWord.length === 1 ? error.candWord[0] : '',
            userText: '',
            checkedSection: null,
            start: error.start,
            end: error.end,
            errorIdx: error.errorIdx,
          });
        });
      }
      if (item.ibody) {
        item.ibody.forEach(subItem => extractErrors(subItem, errors));
      }
      if (item.table) {
        item.table.forEach(row => row.forEach(cell => extractErrors(cell, errors)));
      }
      if (item.notes) {
        item.notes.forEach(note => {
          const noteIndex = note.noteNum - 1;
          const noteType = note.noteInfoType === 'FOOT_NOTE' ? 'footNote' : 'endNote';
          if (data[noteType] && data[noteType][noteIndex]) {
            data[noteType][noteIndex].forEach(noteItem => extractErrors(noteItem, errors));
          }
        });
      }
      return errors;
    };

    const allErrors = extractErrors({ ibody: data.body });

    setErrors(allErrors);
  }, [data]);

  const handleReplacementSelection = (index, selectedOption) => {
    setErrors(
      errors.map((error, i) =>
        i === index ? { ...error, selectedReplacement: selectedOption, checkedSection: 'replacement' } : error,
      ),
    );
  };

  const handleUserTextChange = (index, text) => {
    setErrors(errors.map((error, i) => (i === index ? { ...error, userText: text, checkedSection: 'user' } : error)));
  };

  const toggleCheck = (index, section) => {
    setErrors(
      errors.map((error, i) =>
        i === index ? { ...error, checkedSection: error.checkedSection === section ? null : section } : error,
      ),
    );
  };

  const applyChanges = () => {
    const updatedData = JSON.parse(JSON.stringify(data)); // 데이터 깊은 복사
    let isValid = true;

    const updateError = (section, error, newText, offset) => {
      // 특정 에러 텍스트를 새로운 텍스트로 대체하는 함수
      section.orgStr =
        section.orgStr.slice(0, error.start + offset) + newText + section.orgStr.slice(error.end + offset);
    };

    const updateContent = body => {
      // 데이터 본문을 순회하면서 에러 정보를 업데이트하는 함수
      body.forEach(section => {
        if (section.type === 'PARAGRAPH' && section.errors && section.errors.length > 0) {
          let offset = 0;
          const updatedErrors = [];
          section.errors.forEach(error => {
            const errorToApply = errors.find(
              e => e.paragraphId === section.id && e.start === error.start && e.errorIdx === error.errorIdx,
            );
            if (errorToApply) {
              let newText;
              if (errorToApply.checkedSection === 'original') {
                newText = errorToApply.originalText;
                error.replaceStr = newText;
              } else if (errorToApply.checkedSection === 'replacement') {
                newText = errorToApply.selectedReplacement;
                error.replaceStr = newText;
              } else if (errorToApply.checkedSection === 'user') {
                newText = errorToApply.userText;
                if (!newText.trim()) {
                  isValid = false;
                }
                error.replaceStr = newText;
              } else {
                newText = error.orgStr;
              }

              // 기존 에러 텍스트 부분만 바뀌도록 처리
              updateError(section, error, newText, offset);

              // 오프셋을 업데이트하여 다음 에러 위치를 보정
              const lengthChange = newText.length - (error.end - error.start);
              offset += lengthChange;

              // 수정된 에러를 리스트에 추가
              updatedErrors.push({
                ...error,
                start: error.start + offset - lengthChange, // offset 적용 전 위치
                end: error.start + newText.length + offset - lengthChange,
              });
            } else {
              // 기존의 에러를 그대로 리스트에 추가
              updatedErrors.push({ ...error, start: error.start + offset, end: error.end + offset });
            }
          });
          // 섹션의 에러를 업데이트
          section.errors = updatedErrors;
        }

        if (section.table) {
          section.table.forEach(row => row.forEach(cell => updateContent(cell.ibody)));
        }

        if (section.notes) {
          section.notes.forEach(note => {
            const noteIndex = note.noteNum - 1;
            const noteType = note.noteInfoType === 'FOOT_NOTE' ? 'footNote' : 'endNote';
            if (data[noteType] && data[noteType][noteIndex]) {
              data[noteType][noteIndex].forEach(noteItem => updateContent([noteItem]));
            }
          });
        }
      });
    };

    updateContent(updatedData.body);

    if (!isValid) {
      alert('직접 수정할 내용을 입력해주세요.');
    } else {
      onUpdateData(updatedData);
    }
  };

  return (
    <div className="flex flex-col h-[60vh] w-[30%]">
      <div className="bg-slate-700 h-14 pb-3 sticky top-0">
        <div className="text-white text-lg pl-5 pt-3 fontSB">수정하기</div>
      </div>
      <div className="w-full h-full bg-white border-b border-r border-stone-300 scroll overflow-y-scroll">
        {errors.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-xl fontBold">추천 수정사항이 없습니다!</div>
          </div>
        ) : (
          errors.map((error, index) => (
            <div
              key={`${error.start}-${error.errorIdx}`}
              id={`modifyBox-${error.start}-${error.errorIdx}`}
              className="modifyBox px-4 pb-1 text-sm"
              onClick={() => onBoxClick(error.start, error.errorIdx)}
              style={{ cursor: 'pointer' }}>
              <div className="flex items-center my-2">
                <div className="text-black fontBold mr-5">기존 내용</div>
                <div className="fontBold text-red-500">{error.originalText}</div>
                <FaRegCheckCircle
                  size="18"
                  className={`cursor-pointer ml-auto ${
                    error.checkedSection === 'original' ? 'text-green-500' : 'text-gray-300'
                  }`}
                  onClick={() => toggleCheck(index, 'original')}
                />
              </div>
              <div className="flex items-center my-4">
                <div className="text-black fontBold mr-5">추천 수정</div>
                {error.replacementOptions.length > 1 ? (
                  <>
                    <select
                      value={error.selectedReplacement}
                      onChange={e => handleReplacementSelection(index, e.target.value)}>
                      <option value="">선택하세요</option>
                      {error.replacementOptions.map((option, optIndex) => (
                        <option key={optIndex} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <FaRegCheckCircle
                      size="18"
                      className={`cursor-pointer ml-auto ${
                        error.checkedSection === 'replacement' ? 'text-green-500' : 'text-gray-300'
                      }`}
                      onClick={() => toggleCheck(index, 'replacement')}
                    />
                  </>
                ) : (
                  <>
                    <div className="fontBold">{error.replacementOptions[0]}</div>
                    <FaRegCheckCircle
                      size="18"
                      className={`cursor-pointer ml-auto ${
                        error.checkedSection === 'replacement' ? 'text-green-500' : 'text-gray-300'
                      }`}
                      onClick={() => toggleCheck(index, 'replacement')}
                    />
                  </>
                )}
              </div>
              <div className="flex my-4">
                <div className="text-black fontBold mr-4">직접 수정</div>
                <input
                  type="text"
                  className="pl-1 w-2/3"
                  placeholder="원하는 대치어를 입력하세요."
                  value={error.userText}
                  onChange={e => handleUserTextChange(index, e.target.value)}
                />
                <FaRegCheckCircle
                  size="18"
                  className={`cursor-pointer ml-auto ${
                    error.checkedSection === 'user' ? 'text-green-500' : 'text-gray-300'
                  }`}
                  onClick={() => toggleCheck(index, 'user')}
                />
              </div>
              <div className="flex justify-end">
                <button
                  className="text-white text-xs px-5 py-1.5 bg-slate-700 fontBold rounded-[14px]"
                  onClick={applyChanges}>
                  적용
                </button>
              </div>
              <hr className="w-full border border-gray-200 my-2" />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CheckerModify;
