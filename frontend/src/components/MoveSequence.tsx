import React from 'react';

export interface MoveChip {
  id: string;              // Unique identifier for highlighting
  notation: string;        // "e4", "Nf6", "O-O"
  fen: string;             // Absolute board position after this move
  moveNumber: number;      // 1, 2, 3, 4...
  color: 'white' | 'black'; // For chip styling
}

export interface MoveSequence {
  id: string;              // Unique identifier
  label: string;           // "Aggressive plan: Attack kingside"
  chips: MoveChip[];       // Array of position bookmarks
}

interface MoveChipProps {
  chip: MoveChip;
  isSelected: boolean;
  onClick: (chip: MoveChip) => void;
}

function MoveChipComponent({ chip, isSelected, onClick }: MoveChipProps) {
  const chipStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '6px 12px',
    margin: '0 4px',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    cursor: 'pointer',
    border: isSelected ? '2px solid #4CAF50' : '1px solid #666',
    backgroundColor: chip.color === 'white' ? '#fff' : '#333',
    color: chip.color === 'white' ? '#000' : '#fff',
    transition: 'all 0.2s',
    fontWeight: isSelected ? 'bold' : 'normal',
  };

  return (
    <button
      style={chipStyle}
      onClick={() => onClick(chip)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {chip.notation}
    </button>
  );
}

interface MoveSequenceProps {
  sequence: MoveSequence;
  selectedChipId: string | null;
  onChipClick: (chip: MoveChip) => void;
}

export function MoveSequenceComponent({
  sequence,
  selectedChipId,
  onChipClick
}: MoveSequenceProps) {
  return (
    <div style={{
      marginTop: '12px',
      padding: '12px',
      backgroundColor: '#2a2a2a',
      borderRadius: '8px',
      borderLeft: '3px solid #4CAF50'
    }}>
      {/* Sequence Label */}
      <div style={{
        fontSize: '0.85rem',
        color: '#aaa',
        marginBottom: '8px',
        fontWeight: '500'
      }}>
        {sequence.label}
      </div>

      {/* Move Chips Row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        alignItems: 'center'
      }}>
        {sequence.chips.map((chip) => (
          <MoveChipComponent
            key={chip.id}
            chip={chip}
            isSelected={chip.id === selectedChipId}
            onClick={onChipClick}
          />
        ))}
      </div>
    </div>
  );
}
