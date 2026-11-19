<p align="center">
  <img src="assets/banner.png" alt="Dhia Eddine Jedidi - AI Engineer Banner" width="100%">
</p>

<div align="center">

# Hi, I'm Dhia Eddine Jedidi 👋

### AI / Machine Learning / Data Science Engineer

![Portrait](assets/portrait.jpeg)

Building AI systems that go beyond notebooks — from experimentation and benchmarking to APIs, Docker deployment and production inference.

📍 Bizerte, Tunisia · Open to relocation

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Dhia%20Eddine%20Jedidi-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/dhia-eddine-jdidi)
[![GitHub](https://img.shields.io/badge/GitHub-Dhaw208-181717?style=for-the-badge&logo=github)](https://github.com/Dhaw208)

</div>

---

## 👨‍💻 About Me

I'm an AI/ML Engineer focused on turning machine learning models into usable, production-ready systems.

My experience covers:

- 🧠 Machine Learning & Deep Learning
- 👁️ Computer Vision
- 💬 NLP, Transformers & LLM applications
- 🔎 RAG, Graph-RAG & AI Agents
- ⚙️ Model optimisation and inference
- 🚀 Flask / FastAPI model deployment
- 🐳 Docker-based AI systems
- 📊 Data Engineering, BI & Forecasting

I enjoy working on problems where AI has to perform reliably outside the notebook.

---

## 🚀 What I've Worked On

### 🏭 OctoNorm — Industrial Visual Quality Control

![Octomiro logo](assets/logos/octomiro.png)

AI-powered visual inspection system developed during my AI Engineering internship at **Octomiro**.

- Replaced approximately **1 hour of manual production stoppage** with **6–10 second inspections per tray**
- Benchmarked **10 AI pipelines**
- Worked with **3,300+ annotated instances**
- Achieved **0.967 AUROC**
- Deployed using **Flask + React + Docker**
- Production inference running on a **V100S GPU server**
- Built a retraining workflow accessible from the operator dashboard

[Demo: Video walkthrough](/assets/demos/octonorm-industrial-visual-quality-control.mp4)
[Demo: Full presentation](https://www.canva.com/design/DAHMHPYnsjM/UDcx2-3up850nXb8qghgPQ/view)

#### From manual inspection to an operator-facing system

OctoNorm addresses industrial visual quality control through AI-powered tray inspections. Developed during my AI Engineering internship at Octomiro, it connects model benchmarking with a deployed application that operators can use.

The implementation combines Flask, React and Docker, with production inference on a V100S GPU server. A retraining workflow is accessible from the operator dashboard, bringing model updates into the same application used for inspection.

---

### 📄 OCR + BERT Document Classification

![El Fouladh logo](assets/logos/el-fouladh.png)

Developed during my internship at **El Fouladh**.

- OCR + BERT document classification pipeline
- Achieved **96% accuracy**
- Exposed through a **Flask REST API**
- Automated document routing
- Reduced processing time by approximately **90%**

[Live Demo](https://www.linkedin.com/feed/update/urn:li:activity:7372196138487287808/)

#### From documents to automated routing

This project combines OCR with a BERT document classification pipeline, developed during my internship at El Fouladh. The pipeline supports automated document routing, connecting document processing with classification.

A Flask REST API exposes the pipeline for application integration. The reported results cover both classification quality and document processing time, as listed below.

---

### 🎮 BGA X-Ray Defect Detection

![MPSI logo](assets/logos/mpsi.svg)

Developed during my final-year internship (Applied Mathematics: Data Science) at **MPSI** (Maintenance Partner Solutions International), a Sony PlayStation after-sales service and refurbishment subcontractor in Tunisia.

- Deep-learning classifier for X-ray images of BGA components on PlayStation boards, detecting solder-ball short circuits ("CC billes") on the SoC
- Dataset provided by MPSI: **720 X-ray images** (375 normal, 355 short-circuit), expanded to **5,439 images** with data augmentation
- Compared pre-trained CNNs and selected **VGG16**, tuned for 20 epochs, the Adam optimizer and a 0.0001 learning rate
- Data augmentation lifted test accuracy from about **64% to about 94%**
- Delivered as a web application where operators upload an X-ray image and get a result, with test history, supervisor and administrator roles

`Python` · `TensorFlow` · `Keras` · `VGG16` · `Jupyter Notebook`

#### From manual X-ray inspection to automatic detection

MPSI repairs and refurbishes electronic boards, including PlayStation consoles, and checks BGA (ball grid array) components with X-ray imaging. The goal of this internship was a fast, easy-to-use model that detects defects automatically and reduces human intervention in the inspection step. The work focused on the short-circuit case on the SoC.

The pipeline preprocesses the X-ray images (border and corner cropping, artifact removal with histogram equalization and region-of-interest handling, resizing), then classifies them with a transfer-learned CNN. Several pre-trained architectures were compared, and VGG16 gave the highest accuracy and lowest loss. Training on the augmented dataset raised test accuracy from 0.638 to 0.94, with a test loss falling from 0.98 to 0.23.

The model was then wrapped in a web application designed with UML use-case and sequence diagrams. Workers test a component by submitting its X-ray image and name and can review the history of saved tests, supervisors check their decisions, and administrators manage the component database.

---

### 🎯 YOLOv8 Object Detection

![Concept illustration: YOLOv8 Object Detection](assets/projects/yolov8-object-detection.svg)

Freelance AI project focused on model optimisation.

- Fine-tuned YOLOv8
- Improved mAP from **0.72 → 0.91**
- Exported and optimised inference using ONNX
- Reduced inference latency by **45%**

#### Fine-tuning and inference optimisation

This freelance project focused on optimising a YOLOv8 object detection model. The work included fine-tuning the model and exporting it to ONNX for optimised inference.

The project evaluated both detection quality, measured by mAP, and inference latency. This connects model training improvements with the speed of running the model.

---

## 🔬 Featured Projects

### 🎮 Gaming Anxiety Data Analysis

![Concept illustration: Gaming Anxiety Data Analysis](assets/projects/gaming-anxiety-data-analysis.svg)

`Python` · `Jupyter Notebook` · `Pandas` · `Plotly` · `scikit-learn`

- Statistical analysis of anxiety metrics from an online gaming survey
- Explored how gaming habits relate to anxiety levels
- Visualizations of the findings and a discussion of possible interventions
- Dataset of **13,464 respondents** and **55 variables**

[GitHub](https://github.com/dhiaeddinejedidi/GamingBehavior)
[Live Demo](https://www.linkedin.com/posts/dhia-eddine-jedidi-76927222b_datascience-gaminganxiety-mentalhealth-ugcPost-7217638928781033472-vzAq/)
[Kaggle Notebook](https://www.kaggle.com/code/dhia0208/gaming-anxiety)

#### Understanding the link between gaming and anxiety

This data science project examines how gaming habits relate to anxiety. It is built in a Jupyter notebook on the public Online Gaming Anxiety dataset from Kaggle, which combines standardized questionnaires (GAD-7 anxiety, Satisfaction With Life and social phobia scales) with details about what, how long and why people play, plus demographics.

The analysis covers the dataset's structure and missing values, descriptive statistics, a correlation heatmap and distribution charts for variables such as age and gender. The sample is young (mean age about 21) and mostly male, which shapes how far the results can be generalized. The notebook closes with thoughts on possible interventions.

The project was published on GitHub and Kaggle and shared on LinkedIn. It strengthened my practical skills in data cleaning, statistical analysis and data visualization.

---

### 📊 BI & Analytics Platform

![Concept illustration: BI & Analytics Platform](assets/projects/bi-analytics-platform.svg)

`PostgreSQL` · `Talend` · `Python` · `Power BI` · `Flask` · `Angular`

- Data warehouse for supply-chain analytics
- Automated ETL pipelines
- ML/DL demand forecasting
- Interactive Power BI dashboards

[Live Demo](https://www.linkedin.com/feed/update/urn:li:ugcPost:7331246649878454272/)

#### Connecting supply-chain data with forecasting

This platform brings together a supply-chain analytics data warehouse, automated ETL pipelines, demand forecasting and interactive dashboards. Its technology stack includes PostgreSQL, Talend, Python, Power BI, Flask and Angular.

Machine learning and deep learning are used for demand forecasting, while Power BI dashboards present the analytics interactively. The project spans data preparation, forecasting and presentation.

---

### 🎥 Video Emotion Recognition

![Concept illustration: Video Emotion Recognition](assets/projects/video-emotion-recognition.svg)

`PyTorch` · `OpenCV` · `3D CNN` · `Autoencoder` · `LSTM` · `Attention`

Built a multi-stage deep learning pipeline for video emotion recognition using the CREMA-D dataset, exposed through a Flask API with a Streamlit webcam interface.

#### A video model with an interactive interface

This project uses the CREMA-D dataset in a multi-stage deep learning pipeline for video emotion recognition. The documented stack includes PyTorch, OpenCV, 3D CNN, autoencoder, LSTM and attention components.

The pipeline is exposed through a Flask API and paired with a Streamlit webcam interface. This makes the project more than a training experiment: it includes an interface for interacting with the video emotion recognition pipeline.

---

### 🌐 Twitter Influence Graph Analysis

![Concept illustration: Twitter Influence Graph Analysis](assets/projects/twitter-influence-graph-analysis.svg)

`BERTweet` · `GNN` · `Graph-RAG` · `PyTorch Geometric`

- Sentiment analysis on **1.6M tweets**
- **92% sentiment classification accuracy**
- Influence graph containing 150K nodes and 500K edges
- Applied GNNs and Graph-RAG for influencer detection

#### Combining sentiment with graph-based analysis

This project combines tweet sentiment analysis with an influence graph for influencer detection. Its documented stack includes BERTweet, GNNs, Graph-RAG and PyTorch Geometric.

Sentiment analysis covers 1.6 million tweets, and the influence graph contains 150,000 nodes and 500,000 edges. GNNs and Graph-RAG are applied to influencer detection, connecting language analysis with relationships represented in the graph.

---

## 🧠 AI & Machine Learning Stack

### Machine Learning

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![Scikit Learn](https://img.shields.io/badge/scikit--learn-F7931E?style=flat-square&logo=scikitlearn&logoColor=white)
![XGBoost](https://img.shields.io/badge/XGBoost-ML-blue?style=flat-square)
![Pandas](https://img.shields.io/badge/Pandas-150458?style=flat-square&logo=pandas&logoColor=white)

### Deep Learning

![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)
![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?style=flat-square&logo=tensorflow&logoColor=white)
![Keras](https://img.shields.io/badge/Keras-D00000?style=flat-square&logo=keras&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat-square&logo=opencv&logoColor=white)

### Generative AI

![Hugging Face](https://img.shields.io/badge/HuggingFace-Transformers-yellow?style=flat-square)
![OpenAI](https://img.shields.io/badge/OpenAI-API-412991?style=flat-square&logo=openai&logoColor=white)
![RAG](https://img.shields.io/badge/RAG-Systems-purple?style=flat-square)
![LLM](https://img.shields.io/badge/LLM-Agents-green?style=flat-square)

### Deployment & MLOps

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=flat-square&logo=flask&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black)
![Git](https://img.shields.io/badge/Git-F05032?style=flat-square&logo=git&logoColor=white)
![Azure](https://img.shields.io/badge/Azure-AI%20Foundry-0078D4?style=flat-square&logo=microsoftazure&logoColor=white)

### Data & BI

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Power BI](https://img.shields.io/badge/Power%20BI-F2C811?style=flat-square&logo=powerbi&logoColor=black)
![SQL](https://img.shields.io/badge/SQL-Data-blue?style=flat-square)

---

## 📈 GitHub Stats

<div align="center">

<img height="165" src="https://github-readme-stats.vercel.app/api?username=Dhaw208&amp;show_icons=true&amp;theme=tokyonight&amp;hide_border=true" alt="Dhia Eddine Jedidi's GitHub stats" />

<img height="165" src="https://github-readme-stats.vercel.app/api/top-langs/?username=Dhaw208&amp;layout=compact&amp;theme=tokyonight&amp;hide_border=true" alt="Most used languages on GitHub" />

</div>

---

## 🔥 GitHub Streak

<div align="center">

<img src="https://streak-stats.demolab.com?user=Dhaw208&amp;theme=tokyonight&amp;hide_border=true" alt="Dhia Eddine Jedidi's GitHub contribution streak" />

</div>

---

## 🎓 Education

**Engineering Degree in Computer Science — Data Science Track**  
ESPRIT, Tunis · Expected 2026

**BSc Applied Mathematics — Data Science**  
FST, University of Tunis El Manar · 2020–2023

---

## 📜 Certifications

- NVIDIA — Fundamentals of Deep Learning
- NVIDIA — AI for Predictive Maintenance
- NVIDIA — Transformer-Based NLP Applications
- IBM — Deep Learning with PyTorch
- AWS — Cloud Foundations
- The Hashgraph Association — Hashgraph Developer Course

---

## 🌍 Languages

🇹🇳 Arabic — Native  
🇫🇷 French — B2  
🇬🇧 English — B2

---

<div align="center">

### 🤝 Let's Connect

I'm interested in opportunities in **AI Engineering, Machine Learning, Computer Vision, NLP, Generative AI and Data Science**.

[LinkedIn](https://linkedin.com/in/dhia-eddine-jdidi) ·
[GitHub](https://github.com/Dhaw208)

</div>
