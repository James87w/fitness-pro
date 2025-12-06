import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useExercises } from '../hooks/useExercises';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { toKg, formatWeight } from '../unitUtils';
import { Search, Check, X, Plus, Save, Trash2, ArrowLeft, Dumbbell, Clock, MapPin } from 'lucide-react';

// Manual history logger: no timer/rest, focus on date + sets
const HistoryEntry = ({ unit = 'lbs', onComplete, onCancel }) => {
  const { exercises, loading: loadingEx } = useExercises();
  const { user } = useAuth();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('Log Workout');

  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [filteredExercises, setFilteredExercises] = useState([]);

  const [inputWeight, setInputWeight] = useState('');
  const [inputReps, setInputReps] = useState('');
  const [inputDuration, setInputDuration] = useState('');
  const [inputDistance, setInputDistance] = useState('');

  const [queue, setQueue] = useState([]);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (exercises.length > 0) setFilteredExercises(exercises);
  }, [exercises]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchChange = (e) => {
    const text = e.target.value;
    setSearchTerm(text);
    setShowDropdown(true);
    setSelectedExercise(null);
    setFilteredExercises(
      exercises.filter((ex) => ex.name.toLowerCase().includes(text.toLowerCase()))
    );
  };

  const handleSelectExercise = (ex) => {
    setSelectedExercise(ex);
    setSearchTerm(ex.name);
    setShowDropdown(false);
  };

  const canAdd = useMemo(() => {
    if (!selectedExercise) return false;
    const type = selectedExercise.typeCode;
    if (type === 'weight_reps') return inputWeight && inputReps;
    if (type === 'bodyweight_reps') return inputReps;
    if (type === 'duration') return inputDuration;
    if (type === 'distance_duration') return inputDistance && inputDuration;
    return false;
  }, [selectedExercise, inputWeight, inputReps, inputDuration, inputDistance]);

  const addSet = () => {
    if (!canAdd) return;
    const type = selectedExercise.typeCode;
    const payload = {
      id: crypto.randomUUID(),
      exercise: selectedExercise,
      typeCode: type,
      weight_kg:
        type === 'weight_reps'
          ? toKg(inputWeight, unit)
          : type === 'bodyweight_reps'
          ? 0
          : null,
      reps: type === 'weight_reps' || type === 'bodyweight_reps' ? parseInt(inputReps, 10) : null,
      duration_seconds: type === 'duration' || type === 'distance_duration' ? parseInt(inputDuration, 10) : null,
      distance_meters: type === 'distance_duration' ? parseFloat(inputDistance) : null, // meters input
    };
    setQueue((prev) => [...prev, payload]);
  };

  const deleteSet = (id) => {
    setQueue((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = async () => {
    if (!user) return alert('Please sign in first.');
    if (queue.length === 0) return alert('Add at least one set.');
    setSaving(true);
    try {
      const { data: session, error: sessErr } = await supabase
        .from('workout_sessions')
        .upsert(
          { user_id: user.id, date, title, mode: 'history_entry' },
          { onConflict: 'user_id,date' }
        )
        .select()
        .single();
      if (sessErr) throw sessErr;

      const rows = queue.map((item, idx) => ({
        session_id: session.id,
        exercise_id: item.exercise.id,
        set_order: idx + 1,
        weight_kg: item.weight_kg,
        reps: item.reps,
        duration_seconds: item.duration_seconds,
        distance_meters: item.distance_meters,
        plan_item_id: null,
      }));

      const { error: setErr } = await supabase.from('workout_sets').insert(rows);
      if (setErr) throw setErr;
      onComplete?.();
    } catch (err) {
      alert(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const renderInputs = () => {
    if (!selectedExercise) {
      return <div className="text-gray-400 text-sm">Select an exercise</div>;
    }
    const type = selectedExercise.typeCode;
    if (type === 'weight_reps' || type === 'bodyweight_reps') {
      return (
        <div className="flex gap-3">
          {type === 'weight_reps' && (
            <div className="w-1/2 relative">
              <input
                type="number"
                placeholder="Weight"
                value={inputWeight}
                onChange={(e) => setInputWeight(e.target.value)}
                className="w-full p-3 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="absolute right-3 top-3 text-gray-400 text-sm">{unit}</span>
            </div>
          )}
          <div className={type === 'weight_reps' ? 'w-1/2 relative' : 'w-full relative'}>
            <input
              type="number"
              placeholder="Reps"
              value={inputReps}
              onChange={(e) => setInputReps(e.target.value)}
              className="w-full p-3 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
            />
              <span className="absolute right-3 top-3 text-gray-400 text-sm">Reps</span>
          </div>
        </div>
      );
    }
    if (type === 'duration') {
      return (
        <div className="w-full relative">
          <input
            type="number"
            placeholder="Duration (sec)"
            value={inputDuration}
            onChange={(e) => setInputDuration(e.target.value)}
            className="w-full p-3 border border-purple-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400"
          />
          <span className="absolute right-3 top-3 text-gray-400 text-sm">sec</span>
        </div>
      );
    }
    if (type === 'distance_duration') {
      return (
        <div className="flex gap-3">
          <div className="w-1/2 relative">
            <input
              type="number"
              placeholder="Distance (m)"
              value={inputDistance}
              onChange={(e) => setInputDistance(e.target.value)}
              className="w-full p-3 border border-green-200 rounded-lg outline-none focus:ring-2 focus:ring-green-400"
            />
            <span className="absolute right-3 top-3 text-gray-400 text-sm">m</span>
          </div>
          <div className="w-1/2 relative">
            <input
              type="number"
              placeholder="Duration (sec)"
              value={inputDuration}
              onChange={(e) => setInputDuration(e.target.value)}
              className="w-full p-3 border border-green-200 rounded-lg outline-none focus:ring-2 focus:ring-green-400"
            />
            <span className="absolute right-3 top-3 text-gray-400 text-sm">sec</span>
          </div>
        </div>
      );
    }
    return <div className="text-red-500 text-sm">Unknown exercise type</div>;
  };

  return (
    <div className="bg-white min-h-screen font-sans text-gray-800 pb-20">
      <div className="max-w-md mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 active:bg-gray-100 rounded-full p-2"
            aria-label="back"
          >
            <ArrowLeft />
          </button>
          <h2 className="text-xl font-bold">History Log</h2>
          <div className="w-8" />
        </div>

        <div className="flex gap-3 mb-6">
          <div className="flex-1">
            <label className="text-xs text-gray-500">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg outline-none"
            />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl mb-6 shadow-sm border border-gray-200" ref={dropdownRef}>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Dumbbell size={16} /> Select Exercise
          </h3>
          <div className="space-y-4">
            <div className="relative">
              <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 gap-2">
                <div className="text-gray-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search exercise..."
                  className="flex-1 p-3 outline-none text-gray-800 placeholder-gray-400"
                />
                {selectedExercise && (
                  <div className="text-green-500">
                    <Check size={18} />
                  </div>
                )}
                {(searchTerm || selectedExercise) && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedExercise(null);
                      setFilteredExercises(exercises);
                      setShowDropdown(true);
                      setInputWeight('');
                      setInputReps('');
                      setInputDuration('');
                      setInputDistance('');
                    }}
                    className="px-3 py-1 text-xs text-white bg-red-500 rounded-full hover:bg-red-600"
                    aria-label="clear"
                  >
                    Clear
                  </button>
                )}
              </div>
              {showDropdown && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {loadingEx && <li className="p-3 text-gray-400">Loading...</li>}
                  {!loadingEx &&
                    filteredExercises.map((ex) => (
                      <li
                        key={ex.id}
                        onClick={() => handleSelectExercise(ex)}
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 flex justify-between"
                      >
                        <span>{ex.name}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                          {ex.primaryMuscle}
                        </span>
                      </li>
                    ))}
                  {!loadingEx && filteredExercises.length === 0 && (
                    <li className="p-3 text-gray-400 text-sm">No exercise found. Add in library first.</li>
                  )}
                </ul>
              )}
            </div>

            <div>{renderInputs()}</div>

            <button
              onClick={addSet}
              disabled={!canAdd}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={18} /> Add to list
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-24">
          {queue.length === 0 && (
            <div className="p-4 border border-dashed border-gray-200 rounded-xl text-center text-gray-400">
              No sets yet. Select an exercise and add details.
            </div>
          )}
          {queue.map((item, idx) => (
            <div
              key={item.id}
              className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm flex justify-between items-center"
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-mono flex items-center justify-center">
                  {idx + 1}
                </div>
                <div className="flex flex-col">
                  <div className="font-semibold text-gray-800 flex items-center gap-2">
                    {item.exercise.name}
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {item.typeCode}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-2">
                    {item.typeCode === 'weight_reps' && (
                      <span>
                        {formatWeight(item.weight_kg, unit)} {unit} × {item.reps} Reps
                      </span>
                    )}
                    {item.typeCode === 'bodyweight_reps' && <span>Bodyweight × {item.reps} Reps</span>}
                    {item.typeCode === 'duration' && <span>{item.duration_seconds} sec</span>}
                    {item.typeCode === 'distance_duration' && (
                      <span>
                        {item.distance_meters} m / {item.duration_seconds} sec
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteSet(item.id)}
                className="p-2 text-gray-300 hover:text-red-500"
                aria-label="delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-white border-t border-gray-100 z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleSave}
              disabled={saving || queue.length === 0}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? 'Saving...' : <><Save size={20} /> Save</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryEntry;

