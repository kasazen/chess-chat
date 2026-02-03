import '@testing-library/jest-dom';

// Mock scrollIntoView which is not implemented in JSDOM
Element.prototype.scrollIntoView = () => {};

// Mock getBoundingClientRect for react-chessboard
Element.prototype.getBoundingClientRect = function() {
  return {
    width: 400,
    height: 400,
    top: 0,
    left: 0,
    bottom: 400,
    right: 400,
    x: 0,
    y: 0,
    toJSON: () => {}
  };
};
