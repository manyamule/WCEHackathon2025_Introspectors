import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import React, { useEffect, useCallback } from 'react';


const Page = () => {

  const [siteId, setSiteId] = useState('site_104');
  const [pollutantType, setPollutantType] = useState('PM2.5');
  const [graphData, setGraphData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [availableSites, setAvailableSites] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [model, setModel] = useState('Recommended');
  const [parameter, setParameter] = useState('');
  const [startDate, setStartDate] = useState('2023-12-29');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]); // Today's date

  const pollutantOptions = [
    { id: 'PM2.5', name: 'PM2.5' },
    { id: 'PM10', name: 'PM10' }
  ];

  const modelOptions = [
    { id: 'Recommended', name: 'Recommended' },
    { id: 'ARIMA', name: 'ARIMA' },
    { id: 'Prophet', name: 'Prophet' },
    { id: 'LSTM', name: 'LSTM' }
  ];

  const parameterOptions = [
    { id: '', name: 'Select' },
    { id: 'pm25', name: 'PM2.5' },
    { id: 'pm10', name: 'PM10' }
  ];

  // Load available site IDs from CSV
  useEffect(() => {
    const fetchSiteIds = async () => {
      try {
        // Use a default site to get data that will contain all possible site IDs
        const defaultSiteId = 'site_104';
        const defaultParam = 'pm2.5cnc';
        
        const apiUrl = `http://atmos.urbansciences.in/adp/v4/getDeviceDataParam/imei/{site_id}/params/{params_str}/startdate/{start_date}/enddate/{end_date}/ts/mm/avg/15/api/63h3AckbgtY?gaps=1&gap_value=NaN`;
        
        const response = await axios.get(apiUrl);
        
        if (response.data && Array.isArray(response.data)) {
          // Extract unique device IDs from the response
          // This assumes the response data contains a deviceid field
          const uniqueSiteIds = [...new Set(response.data
            .filter(item => item.deviceid)
            .map(item => item.deviceid)
          )];
          
          // If we didn't get any site IDs from the first call,
          // extract them from the API URL structure
          if (uniqueSiteIds.length === 0) {
            // Use a predefined list of site IDs extracted from the site_ids.json
            const predefinedSiteIds = [
              'site_104', 'site_106', 'site_113', 'site_114', 'site_115', 
              'site_117', 'site_118', 'site_119', 'site_122', 'site_124',
              'site_301', 'site_309'
            ];
            
            const sites = predefinedSiteIds.map(id => ({
              id: id,
              name: id // Just use the ID as the name
            }));
            
            setAvailableSites(sites);
            
            // Set default selected site
            if (!siteId || !predefinedSiteIds.includes(siteId)) {
              setSiteId(predefinedSiteIds[0]);
            }
          } else {
            // Format site data
            const sites = uniqueSiteIds.map(id => ({
              id: id,
              name: id // Just use the ID as the name
            }));
            
            setAvailableSites(sites);
            
            // Set default selected site if it's in the list
            if (sites.length > 0 && !sites.find(site => site.id === siteId)) {
              setSiteId(sites[0].id);
            }
          }
        } else {
          throw new Error('Invalid API response format');
        }
      } catch (error) {
        console.error('Error loading site IDs from API:', error);
        toast.error('Failed to load site IDs from API');
        
        // Fallback to default sites if API call fails
        const fallbackSites = [
          { id: 'site_104', name: 'Burari Crossing, Delhi - IMD' },
          { id: 'site_106', name: 'IGI Airport (T3), Delhi - IMD' },
          { id: 'site_113', name: 'Shadipur, Delhi - CPCB' },
          { id: 'site_301', name: 'Anand Vihar, Delhi - DPCC' },
          { id: 'site_309', name: 'Victoria, Kolkata - WBPCB' }
        ];
        
        setAvailableSites(fallbackSites);
        
        if (!siteId || !fallbackSites.some(site => site.id === siteId)) {
          setSiteId(fallbackSites[0].id);
        }
      }
    };
    
    fetchSiteIds();
  }, [siteId]);

  // Memoized fetch function to prevent unnecessary re-renders
  const fetchLiveData = useCallback(async () => {
    if (!siteId) return;
    
    setLoading(true);
    try {
      // Format parameters based on pollutant type
      const paramKey = pollutantType === 'PM2.5' ? 'pm2.5cnc' : 'pm10cnc';
      
      // Format dates for API
      const formattedStartDate = `${startDate}T00:00`;
      const formattedEndDate = `${endDate}T23:59`;
      
      const apiUrl = `http://atmos.urbansciences.in/adp/v4/getDeviceDataParam/imei/${siteId}/params/${paramKey}/startdate/${formattedStartDate}/enddate/${formattedEndDate}/ts/mm/avg/15/api/63h3AckbgtY?gaps=1&gap_value=NaN`;

      const response = await axios.get(apiUrl);
      
      if (response.data && Array.isArray(response.data)) {
        // Process the data
        const processedData = response.data.map(item => ({
          time: new Date(item.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          value: parseFloat(item[paramKey] || 0),
          timestamp: new Date(item.timestamp)
        }));

        // Sort by timestamp
        processedData.sort((a, b) => a.timestamp - b.timestamp);
        
        // Only keep the most recent 24 hours of data
        const recentData = processedData.slice(-96); // 24 hours x 4 (15-minute intervals)
        
        setGraphData(recentData);
        
        // Detect anomalies
        detectAnomalies(recentData);
        
        setLastUpdated(new Date());
      } else {
        toast.warning(`No data available for ${siteId}`);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching live data:', error);
      toast.error('Failed to fetch live air quality data', {
        position: "top-right",
        autoClose: 3000
      });
      setLoading(false);
      
      // Use generated data as fallback
      generateFallbackData();
    }
  }, [siteId, pollutantType, startDate, endDate]);
  
  // Generate fallback data if API fails
  const generateFallbackData = () => {
    // Generate demo data based on the current timestamp
    const now = new Date();
    const data = [];
    
    // Generate 24 hours of hourly data
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      const formattedTime = timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      // Generate values that somewhat depend on the site ID to create variety
      const siteIndex = parseInt(siteId.replace(/\D/g, '')) % 10;
      const timeOfDay = timestamp.getHours();
      
      // Create daily patterns (higher in morning and evening)
      let baseValue = 30 + (siteIndex * 5);
      
      // Morning peak (7-10 AM)
      if (timeOfDay >= 7 && timeOfDay <= 10) {
        baseValue += 40 + (timeOfDay - 7) * 20;
      }
      // Evening peak (5-8 PM)
      else if (timeOfDay >= 17 && timeOfDay <= 20) {
        baseValue += 50 + (timeOfDay - 17) * 15;
      }
      
      // Add some randomness
      const value = Math.round((baseValue + (Math.random() * 30 - 15)) * 100) / 100;
      
      data.push({
        time: formattedTime,
        timestamp: timestamp,
        value: value
      });
    }
    
    setGraphData(data);
    setLastUpdated(new Date());
    
    // Detect anomalies in the generated data
    detectAnomalies(data);
  };

  // Simple anomaly detection based on statistical threshold
  const detectAnomalies = (data) => {
    if (!data || data.length === 0) return;
    
    // Calculate mean and standard deviation
    const values = data.map(item => item.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );
    
    // Define threshold (3 standard deviations)
    const threshold = mean + (3 * stdDev);
    
    // Detect anomalies
    const detectedAnomalies = data.filter(item => item.value > threshold);
    setAnomalies(detectedAnomalies);
  };

  // Fetch data on component mount and when site or pollutant changes
  useEffect(() => {
    fetchLiveData();

    // Set up periodic data refresh (every minute)
    const interval = setInterval(fetchLiveData, 60000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  const resetFilters = () => {
    setParameter('');
    // Reset dates to default
    setStartDate('2023-12-29');
    setEndDate(new Date().toISOString().split('T')[0]);
  };

  // Get site name for display
  const getSiteName = () => {
    const site = availableSites.find(s => s.id === siteId);
    return site ? site.name : siteId;
  };

  // Fetch data on component mount and when site or pollutant changes
  useEffect(() => {
    fetchLiveData();


    // Set up periodic data refresh (every minute)
    const interval = setInterval(fetchLiveData, 60000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [fetchLiveData]);

 

  return (
    <div className="container mx-auto flex px-5 py-12 md:flex-row flex-col items-start w-11/12 bg-green-50">
      {/* Left side - Controls */}
      <div className="lg:w-1/2 md:w-1/2 flex flex-col md:items-start md:text-left mb-8 md:mb-0 items-center text-center p-6">
        <p className="font-poppins text-lg lg:text-2xl text-green-600 tracking-wide mb-6">
          Air Quality Ranges
        </p>

        <div className="flex flex-col gap-4 w-full lg:w-full bg-white p-6 rounded-lg shadow-md">
          {/* Model Selection */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Model
            </label>
            <select
              className="border border-gray-300 p-2 rounded-lg text-black w-full"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {modelOptions.map(option => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>

          {/* Site ID Selection */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Site ID
            </label>
            <select
              className="border border-gray-300 p-2 rounded-lg text-black w-full"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              disabled={loading}
            >
              {availableSites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>

           {/* Date Range Pickers */}
           <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Start Date
              </label>
              <input
                type="date"
                className="border border-gray-300 p-2 rounded-lg text-black w-full"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                End Date
              </label>
              <input
                type="date"
                className="border border-gray-300 p-2 rounded-lg text-black w-full"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>
          </div>

          {/* Reset Filter Button */}
          <div>
            <button
              type="button"
              onClick={resetFilters}
              className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Reset Filter
            </button>
          </div>

          {/* Pollutant Type Selection */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {pollutantOptions.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPollutantType(option.id)}
                className={`py-2 px-4 rounded-lg ${
                  pollutantType === option.id 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white border border-gray-300 text-gray-700'
                }`}
                disabled={loading}
              >
                {option.name}
              </button>
            ))}
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="text-center mt-4">
              <i className="fa-solid fa-rotate text-green-600 text-center text-4xl animate-spin"></i>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Graph */}
      <div className="lg:w-1/2 md:w-1/2 w-full mt-8 md:mt-0 p-6">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-green-600">
              {pollutantType} Air Quality Trend
            </h3>
            
            {/* Anomaly indicator */}
            <div className="text-sm">
              <span className="mr-2">
                Anomalies: 
                <span className={`font-bold ml-1 ${
                  anomalies.length > 0 ? 'text-red-600' : 'text-gray-700'
                }`}>
                  {anomalies.length}
                </span>
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                anomalies.length > 0
                  ? 'bg-red-100 text-red-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                Alert
              </span>
            </div>
          </div>

          {/* Air Quality Legend */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex flex-col items-center">
                <strong><div className="w-full h-6 rounded-t-sm flex items-center justify-center text-green-500">Good</div></strong>
                <div className="w-full text-center text-xs">0-30</div>
              </div>
              <div className="flex flex-col items-center">
                <strong><div className="w-full h-6 flex items-center justify-center text-green-300">Satisfactory</div></strong>
                <div className="w-full text-center text-xs">31-60</div>
              </div>
              <div className="flex flex-col items-center">
                <strong><div className="w-full h-6 flex items-center justify-center text-yellow-400">Moderate</div></strong>
                <div className="w-full text-center text-xs">61-90</div>
              </div>
              <div className="flex flex-col items-center">
                <strong><div className="w-full h-6 flex items-center justify-center text-orange-500">Poor</div></strong>
                <div className="w-full text-center text-xs">91-120</div>
              </div>
              <div className="flex flex-col items-center">
                <strong><div className="w-full h-6 flex items-center justify-center text-red-600">Very Poor</div></strong>
                <div className="w-full text-center text-xs">121-250</div>
              </div>
              <div className="flex flex-col items-center">
                <strong><div className="w-full h-6 rounded-t-sm flex items-center justify-center text-red-900">Severe</div></strong>
                <div className="w-full text-center text-xs">250+</div>
              </div>
            </div>
          </div>

          {/* Line Graph */}
          {loading && graphData.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <p>Loading data...</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={graphData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis 
                    domain={[0, 
                      // Calculate dynamic max based on data, with minimum of 250
                      graphData.length === 0 
                        ? 250 
                        : Math.max(250, Math.max(...graphData.map(item => item.value)) * 1.1)
                    ]} 
                  />
                  <Tooltip 
                    formatter={(value) => [`${value.toFixed(1)} μg/m³`, pollutantType]}
                    labelFormatter={(time) => `Time: ${time}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    name={pollutantType}
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  
                  {/* Anomaly reference lines */}
                  {anomalies.map((anomaly, index) => (
                    <ReferenceLine
                      key={`anomaly-${index}`}
                      x={anomaly.time}
                      stroke="red"
                      strokeDasharray="3 3"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          
          {/* Last updated and site information */}
          <div className="mt-4 flex justify-between text-sm text-gray-500">
            {lastUpdated && (
              <div>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
            <div>
              Site: {getSiteName()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
