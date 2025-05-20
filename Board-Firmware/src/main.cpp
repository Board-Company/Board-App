#include <Arduino.h>

// Multiplexer control pins
const int S0_PIN = 5;    // D5
const int S1_PIN = 18;   // D18
const int S2_PIN = 19;   // D19
const int S3_PIN = 21;   // D21
const int SIG_PIN = 34;  // D34 (ADC input)

// Hall sensor thresholds
const int NO_MAGNET_THRESHOLD = 550;    // Above this is considered no magnet
const int MAGNET_PRESENT_THRESHOLD = 100;  // Below this is considered magnet approaching
const int MAGNET_DIRECT_THRESHOLD = 3500;  // Above this is considered magnet directly over

// Reading configuration
const long INTERVAL = 2000;  // 2 seconds in milliseconds
const int READINGS_PER_INTERVAL = 10;  // Take 10 readings over 5 seconds (one every 500ms)
const int READING_DELAY = 0;  // 500ms between individual readings
const int NUM_CHANNELS = 4;    // Number of channels to read (0-3)

// State tracking
enum MagnetState {
  NO_MAGNET,
  MAGNET_APPROACHING,
  MAGNET_DIRECT,
  MAGNET_LEAVING
};

struct ChannelData {
  MagnetState currentState;
  MagnetState previousState;
  int averageValue;
  float stdDev;
};

ChannelData channels[NUM_CHANNELS];

const char* getStateString(MagnetState state) {
  switch(state) {
    case NO_MAGNET: return "No Magnet";
    case MAGNET_APPROACHING: return "Magnet Approaching";
    case MAGNET_DIRECT: return "Magnet Directly Over";
    case MAGNET_LEAVING: return "Magnet Leaving";
    default: return "Unknown";
  }
}

// Function to set multiplexer channel
void setMuxChannel(byte channel) {
  // Set the control pins based on the channel number
  digitalWrite(S0_PIN, channel & 0x01);
  digitalWrite(S1_PIN, (channel >> 1) & 0x01);
  digitalWrite(S2_PIN, (channel >> 2) & 0x01);
  digitalWrite(S3_PIN, (channel >> 3) & 0x01);
}

// Function to take a single reading from a specific channel
int takeReading(byte channel) {
  setMuxChannel(channel);
  delayMicroseconds(100);  // Let multiplexer settle
  return analogRead(SIG_PIN);
}

// Function to update state for a channel
void updateChannelState(ChannelData &channel, int averageValue) {
  channel.previousState = channel.currentState;
  
  if (averageValue > MAGNET_DIRECT_THRESHOLD) {
    channel.currentState = MAGNET_DIRECT;
  } else if (averageValue < MAGNET_PRESENT_THRESHOLD) {
    channel.currentState = MAGNET_APPROACHING;
  } else if (averageValue < NO_MAGNET_THRESHOLD && channel.previousState != NO_MAGNET) {
    channel.currentState = MAGNET_LEAVING;
  } else {
    channel.currentState = NO_MAGNET;
  }
}

// Function to get heat map character based on ADC value
char getHeatMapChar(int value) {
  if (value > MAGNET_DIRECT_THRESHOLD) return '█';  // Strongest
  if (value > 2500) return '▓';
  if (value > 1500) return '▒';
  if (value > 800) return '░';
  if (value > MAGNET_PRESENT_THRESHOLD) return '·';
  return ' ';  // No magnet
}

// Function to print heat map
void printHeatMap() {
  Serial.println("\nMagnet Heat Map:");
  Serial.println("================");
  Serial.println("Legend:");
  Serial.println("█ - Magnet Directly Over");
  Serial.println("▓ - Very Strong");
  Serial.println("▒ - Strong");
  Serial.println("░ - Moderate");
  Serial.println("· - Weak");
  Serial.println("  - No Magnet");
  Serial.println("================");
  
  // Print channel numbers
  Serial.print("Ch: ");
  for(int i = 0; i < NUM_CHANNELS; i++) {
    Serial.print(i);
    Serial.print("  ");
  }
  Serial.println();
  
  // Print heat map
  Serial.print("    ");
  for(int i = 0; i < NUM_CHANNELS; i++) {
    Serial.print(getHeatMapChar(channels[i].averageValue));
    Serial.print("  ");
  }
  Serial.println();
  
  // Print actual values
  Serial.print("Val:");
  for(int i = 0; i < NUM_CHANNELS; i++) {
    Serial.print(channels[i].averageValue);
    Serial.print(" ");
  }
  Serial.println("\n================");
}

void setup() {
  // Initialize serial communication
  Serial.begin(115200);
  Serial.println("ESP32 Hall Effect Sensor Test with Multiplexer");
  Serial.println("--------------------------------------------");
  Serial.println("Reading " + String(NUM_CHANNELS) + " channels (0-" + String(NUM_CHANNELS-1) + ")");
  Serial.println("Taking " + String(READINGS_PER_INTERVAL) + " readings every " + String(INTERVAL/1000.0) + " seconds");
  Serial.println("Individual readings every " + String(READING_DELAY) + "ms");
  Serial.println("--------------------------------------------");
  
  // Configure multiplexer control pins as outputs
  pinMode(S0_PIN, OUTPUT);
  pinMode(S1_PIN, OUTPUT);
  pinMode(S2_PIN, OUTPUT);
  pinMode(S3_PIN, OUTPUT);
  
  // Initialize channel data
  for(int i = 0; i < NUM_CHANNELS; i++) {
    channels[i].currentState = NO_MAGNET;
    channels[i].previousState = NO_MAGNET;
    channels[i].averageValue = 0;
    channels[i].stdDev = 0;
  }
  
  // Configure ADC
  analogReadResolution(12);  // Set ADC resolution to 12 bits (0-4095)
  analogSetAttenuation(ADC_11db);  // Set attenuation for full range (0-3.3V)
}

void loop() {
  // Process each channel immediately without waiting for interval
  for(int channel = 0; channel < NUM_CHANNELS; channel++) {
    // Take multiple readings and calculate average
    long sum = 0;
    int readings[READINGS_PER_INTERVAL];
    
    // Take all readings for this channel
    for(int i = 0; i < READINGS_PER_INTERVAL; i++) {
      readings[i] = takeReading(channel);
      sum += readings[i];
      delay(READING_DELAY);
    }
    
    // Calculate average
    channels[channel].averageValue = sum / READINGS_PER_INTERVAL;
    
    // Calculate standard deviation
    long sumSquaredDiff = 0;
    for(int i = 0; i < READINGS_PER_INTERVAL; i++) {
      long diff = readings[i] - channels[channel].averageValue;
      sumSquaredDiff += diff * diff;
    }
    channels[channel].stdDev = sqrt(sumSquaredDiff / (float)READINGS_PER_INTERVAL);
    
    // Update state
    updateChannelState(channels[channel], channels[channel].averageValue);
  }
  
  // Print values immediately
  Serial.print("Val:");
  for(int channel = 0; channel < NUM_CHANNELS; channel++) {
    Serial.print(channels[channel].averageValue);
    Serial.print(" ");
  }
  Serial.println();  // Add newline to ensure complete line transmission
  
  // Small delay to prevent overwhelming the serial port
  delay(50);  // 50ms delay between updates
} 