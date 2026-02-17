export interface VoterRecord {
  id: string;
  epicNumber: string;
  name: string;
  relationName: string; // Father/Husband
  gender: "Male" | "Female" | "Other";
  age: number;
  address: string;
  constituency: string;
  partNumber: string;
  serialNumber: number;
  status: "Verified" | "Flagged" | "Incomplete";
}

export const mockVoterRecords: VoterRecord[] = Array.from({ length: 50 }).map((_, i) => ({
  id: `v-${1000 + i}`,
  epicNumber: `GDN${Math.floor(1000000 + Math.random() * 9000000)}`,
  name: ["Aarav Sharma", "Vivaan Singh", "Aditya Kumar", "Vihaan Gupta", "Arjun Patel", "Sai Reddy", "Reyansh Joshi", "Ayaan Malhotra", "Krishna Verma", "Ishaan Bhat"][i % 10],
  relationName: ["Rajesh Sharma", "Amit Singh", "Suresh Kumar", "Manoj Gupta", "Vikram Patel", "Ramesh Reddy", "Sanjay Joshi", "Deepak Malhotra", "Vijay Verma", "Anil Bhat"][i % 10],
  gender: i % 3 === 0 ? "Female" : "Male",
  age: 18 + Math.floor(Math.random() * 60),
  address: `${10 + i}, Gandhi Nagar, Sector ${Math.floor(Math.random() * 20) + 1}, New Delhi`,
  constituency: "New Delhi Central",
  partNumber: `AC-${100 + Math.floor(i / 10)}`,
  serialNumber: i + 1,
  status: Math.random() > 0.8 ? "Flagged" : Math.random() > 0.9 ? "Incomplete" : "Verified",
}));

export interface ProcessingFile {
  id: string;
  name: string;
  size: string;
  uploadTime: string;
  status: "Pending" | "Processing" | "Completed" | "Failed";
  progress: number;
  pagesProcessed: number;
  totalPages: number;
  extractedCount: number;
}

export const mockProcessingFiles: ProcessingFile[] = [
  {
    id: "f-1",
    name: "Delhi_South_Part12.pdf",
    size: "4.2 MB",
    uploadTime: "2 mins ago",
    status: "Processing",
    progress: 45,
    pagesProcessed: 12,
    totalPages: 28,
    extractedCount: 342,
  },
  {
    id: "f-2",
    name: "Mumbai_North_Ward4.pdf",
    size: "12.5 MB",
    uploadTime: "10 mins ago",
    status: "Completed",
    progress: 100,
    pagesProcessed: 45,
    totalPages: 45,
    extractedCount: 1250,
  },
  {
    id: "f-3",
    name: "Bangalore_East_Sec8.pdf",
    size: "8.1 MB",
    uploadTime: "1 hour ago",
    status: "Failed",
    progress: 15,
    pagesProcessed: 3,
    totalPages: 32,
    extractedCount: 45,
  },
  {
    id: "f-4",
    name: "Chennai_Central_Z2.pdf",
    size: "3.4 MB",
    uploadTime: "Pending",
    status: "Pending",
    progress: 0,
    pagesProcessed: 0,
    totalPages: 18,
    extractedCount: 0,
  },
];
