import serial
import re
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import time
import glob

class MagnetVisualizer:
    def __init__(self):
        # Serial port configuration - match ESP32's baud rate
        self.BAUD_RATE = 115200
        
        # Create figure and axis for the plot
        self.fig, (self.ax1, self.ax2) = plt.subplots(2, 1, figsize=(10, 8), height_ratios=[3, 1])
        
        # Initialize data array for 4 channels
        self.data = np.zeros(4)
        self.bars = self.ax1.bar(range(4), self.data, color='blue')
        
        # Set up the bar plot with same thresholds as main.cpp
        self.ax1.set_ylim(0, 4095)  # ADC range is 0-4095
        self.ax1.set_xlabel('Channel')
        self.ax1.set_ylabel('ADC Value')
        self.ax1.set_title('Magnet Position Visualization')
        self.ax1.set_xticks(range(4))
        self.ax1.set_xticklabels([f'Ch {i}' for i in range(4)])
        
        # Add threshold lines to match main.cpp
        self.ax1.axhline(y=550, color='r', linestyle='--', alpha=0.3, label='No Magnet (550)')
        self.ax1.axhline(y=100, color='g', linestyle='--', alpha=0.3, label='Magnet Present (100)')
        self.ax1.axhline(y=3500, color='b', linestyle='--', alpha=0.3, label='Magnet Direct (3500)')
        self.ax1.legend()
        
        # Add a colorbar
        self.sm = plt.cm.ScalarMappable(cmap='viridis', norm=plt.Normalize(0, 4095))
        plt.colorbar(self.sm, ax=self.ax1, label='Magnet Strength')
        
        # Set up the status text
        self.status_text = self.ax2.text(0.5, 0.5, 'Waiting for data...', ha='center', va='center', fontsize=12)
        self.ax2.axis('off')  # Hide axes for status display
        
        # Initialize serial connection
        self.setup_serial()
        
        # Store animation object as instance variable
        self.ani = None
        
        # Buffer for reading partial lines
        self.buffer = ""
        
    def setup_serial(self):
        """Find and connect to the ESP32 serial port"""
        # First try the SLAB port as it's more reliable
        try:
            self.ser = serial.Serial('/dev/tty.SLAB_USBtoUART', self.BAUD_RATE, timeout=0)  # Non-blocking
            print("Connected to /dev/tty.SLAB_USBtoUART")
            # Flush any existing data
            self.ser.reset_input_buffer()
            self.ser.reset_output_buffer()
            # Send a reset command to the ESP32
            self.ser.write(b'\x03')  # Ctrl+C to reset
            time.sleep(0.1)
            self.ser.write(b'\x04')  # Ctrl+D to reset
            time.sleep(0.1)
            return
        except:
            print("Could not connect to SLAB port, trying other ports...")
        
        # If SLAB port fails, try other ports
        ports = glob.glob('/dev/tty.*')
        esp32_ports = [p for p in ports if 'usbserial' in p.lower()]
        
        if not esp32_ports:
            raise Exception("No ESP32 found. Please connect your device.")
        
        # Try each port until we find one that works
        for port in esp32_ports:
            try:
                print(f"Trying to connect to {port}...")
                self.ser = serial.Serial(port, self.BAUD_RATE, timeout=0)  # Non-blocking
                # Flush any existing data
                self.ser.reset_input_buffer()
                self.ser.reset_output_buffer()
                # Send a reset command to the ESP32
                self.ser.write(b'\x03')  # Ctrl+C to reset
                time.sleep(0.1)
                self.ser.write(b'\x04')  # Ctrl+D to reset
                time.sleep(0.1)
                print(f"Connected to {port}")
                return
            except Exception as e:
                print(f"Failed to connect to {port}: {e}")
                continue
        
        raise Exception("Could not connect to ESP32. Please check your connection.")
    
    def get_magnet_state(self, value):
        # Match the thresholds from main.cpp exactly
        if value > 3500:  # MAGNET_DIRECT_THRESHOLD
            return "Magnet Directly Over"
        elif value < 100:  # MAGNET_PRESENT_THRESHOLD
            return "Magnet Approaching"
        elif value < 550:  # NO_MAGNET_THRESHOLD
            return "Magnet Leaving"
        else:
            return "No Magnet"
    
    def read_serial_line(self):
        """Read a complete line from serial, handling partial reads"""
        while self.ser.in_waiting:
            char = self.ser.read().decode('utf-8', errors='ignore')
            if char == '\n':
                line = self.buffer.strip()
                self.buffer = ""
                return line
            elif char == '\r':
                continue
            else:
                self.buffer += char
        return None
    
    def update_plot(self, frame):
        try:
            # Read complete lines from serial
            while True:
                line = self.read_serial_line()
                if line is None:
                    break
                
                # Look for the line containing channel values
                if "Val:" in line:
                    # Extract values after "Val:" and split by whitespace
                    values_str = line.split("Val:")[1].strip()
                    try:
                        values = [int(v) for v in values_str.split()]
                        
                        if len(values) == 4:  # Make sure we have all 4 channel values
                            # Update data array
                            for i in range(4):
                                self.data[i] = values[i]
                            
                            # Update bar heights and colors
                            for bar, value in zip(self.bars, self.data):
                                bar.set_height(value)
                                # Color based on magnet strength (matching main.cpp thresholds)
                                if value > 3500:  # Direct magnet
                                    bar.set_color('red')
                                elif value > 2500:  # Very strong
                                    bar.set_color('orange')
                                elif value > 1500:  # Strong
                                    bar.set_color('yellow')
                                elif value > 800:  # Moderate
                                    bar.set_color('green')
                                elif value > 100:  # Weak
                                    bar.set_color('blue')
                                else:  # No magnet
                                    bar.set_color('gray')
                            
                            # Update status text with exact values
                            status = "Status: " + " | ".join(
                                f"Ch{i}: {self.get_magnet_state(int(v))} ({v})"
                                for i, v in enumerate(values)
                            )
                            self.status_text.set_text(status)
                    except ValueError:
                        continue  # Skip invalid lines
                        
        except serial.SerialException as e:
            print(f"Serial error: {e}")
        except Exception as e:
            print(f"Error: {e}")
        
        # Return a tuple of artists to update
        return tuple(self.bars) + (self.status_text,)

    def run(self):
        # Create animation with a limited cache size
        self.ani = FuncAnimation(
            self.fig, 
            self.update_plot, 
            interval=50,  # Update more frequently to catch all data
            blit=True,     # Use blitting for better performance
            save_count=100,
            cache_frame_data=False
        )
        
        # Show the plot (this will block until the window is closed)
        plt.show()
        
        # Clean up when the window is closed
        self.cleanup()
    
    def cleanup(self):
        """Clean up resources when the visualization is closed"""
        if hasattr(self, 'ser') and self.ser.is_open:
            self.ser.close()
        plt.close('all')

if __name__ == '__main__':
    try:
        visualizer = MagnetVisualizer()
        visualizer.run()
    except KeyboardInterrupt:
        print("\nExiting...")
    except Exception as e:
        print(f"Error: {e}")
        print("Please make sure your ESP32 is connected and the correct port is selected.") 