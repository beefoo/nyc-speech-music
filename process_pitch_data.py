##
# Take melody data in format: time (s), pitch
# and convert to format: start (ms), duration (ms), pitch, midi
##

# Library dependancies
import csv
import json
import os
import sys
from midiutil.MidiFile import MIDIFile

# Config
FILE_NAME = sys.argv[1]
INPUT_FILE = 'data/raw/'+FILE_NAME+'.csv'
OUTPUT_JSON_FILE = 'data/interviews/'+FILE_NAME+'.json'
OUTPUT_MIDI_FILE = 'data/mid/'+FILE_NAME+'.mid'
FREQUENCIES_FILE = 'data/frequencies.json'
PRECISION = 3
BPM = 240
FREQUENCY_NOTE_THRESHOLD = 10
MIN_NOTE_DURATION = 100

# Init
sequence = []
duration = 0

# Get frequency table
json_data = open(FREQUENCIES_FILE)
frequencies = json.load(json_data)

# Mean of list
def mean(data):
	if iter(data) is data:
		data = list(data)
	n = len(data)
	if n < 1:
		return 0
	else:
		return sum(data)/n
		
def getPitchData(pitch):
	global frequencies
	data = frequencies[0]
	for i, f in enumerate(frequencies):
		hz = float(f['hz'])
		prev_hz = 0
		if i > 0:
			prev_hz = float(frequencies[i-1]['hz'])
		if pitch < hz:
			if prev_hz > 0 and abs(prev_hz-pitch) < abs(hz-pitch):
				data = frequencies[i-1]
			else:
				data = f
			break
	return data

# Add new sequence step
def addToSequence(ms, duration, pitch):
	global sequence
	global MIN_NOTE_DURATION
	if duration >= MIN_NOTE_DURATION:
		pd = getPitchData(pitch)
		sequence.append({
			"ms": int(ms), 
			"dur": int(duration), 
			"hz": round(pitch, PRECISION), 
			"note": pd['note'],
			"mid": int(pd['midi'])}
		)
	
# Read frequencies from file
with open(INPUT_FILE, 'rb') as f:
	r = csv.reader(f, delimiter=',')
	pitch_queue = []
	start_ms = 0
	start_pitch = 0
	ms = 0
	for s, p in r:
		if s and p:
			ms = int(round(float(s) * 1000))
			pitch = round(float(p), PRECISION)
			# reached a pause, add previous note queue
			if pitch <= 0 and len(pitch_queue) > 0:
				addToSequence(start_ms, ms-start_ms, mean(pitch_queue))
				pitch_queue = []
			# reached a note threshold, add previous note queue
			elif pitch > 0 and abs(pitch-start_pitch) > FREQUENCY_NOTE_THRESHOLD and (ms-start_ms) > MIN_NOTE_DURATION and len(pitch_queue) > 0:
				addToSequence(start_ms, ms-start_ms, mean(pitch_queue))
				pitch_queue = []
			# add pitch to note queue
			elif pitch > 0:
				if len(pitch_queue) <= 0:
					start_ms = ms
					start_pitch = pitch
				pitch_queue.append(pitch)
	if len(pitch_queue) > 0:
		addToSequence(start_ms, ms-start_ms, mean(pitch_queue))

def msToBeats(ms):
	global BPM
	bpms = 1.0 * BPM / 60 / 1000
	return bpms * ms

# Write sequence to midi file
if len(sequence) > 0:
	duration = sequence[-1]["ms"] + sequence[-1]["dur"]
	
	# Create the MIDIFile Object with 1 track
	MyMIDI = MIDIFile(1)

	# Tracks are numbered from zero. Times are measured in beats.
	track = 0   
	time = 0

	# Add track name and tempo.
	MyMIDI.addTrackName(track,time,"Track")
	MyMIDI.addTempo(track,time,BPM)

	# Add a note. addNote expects the following information:
	track = 0
	channel = 0
	pitch = 60
	time = 0
	duration = 1
	volume = 100

	# Now add the note.
	for step in sequence:
		time = msToBeats(step["ms"])
		duration = msToBeats(step["dur"])
		pitch = min([int(round(step["mid"])), 255])
		MyMIDI.addNote(track,channel,pitch,time,duration,volume)

	# And write it to disk.
	binfile = open(OUTPUT_MIDI_FILE, 'wb')
	MyMIDI.writeFile(binfile)
	binfile.close()
	print('Successfully wrote to file: ' + OUTPUT_MIDI_FILE)

# Write sequence to json file
if len(sequence) > 0:
	with open(OUTPUT_JSON_FILE, 'w') as outfile:
		json.dump(sequence, outfile)
		print('Successfully wrote to JSON file: '+OUTPUT_JSON_FILE)
