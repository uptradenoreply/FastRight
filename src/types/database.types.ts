export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      answers: {
        Row: {
          answered_option: string
          created_at: string
          id: string
          is_correct: boolean
          participant_id: string
          question_id: string
          response_time: number
        }
        Insert: {
          answered_option: string
          created_at?: string
          id?: string
          is_correct?: boolean
          participant_id: string
          question_id: string
          response_time: number
        }
        Update: {
          answered_option?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          participant_id?: string
          question_id?: string
          response_time?: number
        }
        Relationships: [
          {
            foreignKeyName: "answers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          }
        ]
      }
      participants: {
        Row: {
          id: string
          joined_at: string
          nim_or_name: string
          quiz_id: string
          score: number
        }
        Insert: {
          id?: string
          joined_at?: string
          nim_or_name: string
          quiz_id: string
          score?: number
        }
        Update: {
          id?: string
          joined_at?: string
          nim_or_name?: string
          quiz_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "participants_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          }
        ]
      }
      questions: {
        Row: {
          correct_option: string
          created_at: string
          id: string
          options: Json
          question_text: string
          quiz_id: string
          time_limit: number
          order_index: number
        }
        Insert: {
          correct_option: string
          created_at?: string
          id?: string
          options: Json
          question_text: string
          quiz_id: string
          time_limit?: number
          order_index?: number
        }
        Update: {
          correct_option?: string
          created_at?: string
          id?: string
          options?: Json
          question_text?: string
          quiz_id?: string
          time_limit?: number
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          }
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          id: string
          pin: number | null
          status: "waiting" | "active" | "finished"
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin?: number | null
          status?: "waiting" | "active" | "finished"
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          pin?: number | null
          status?: "waiting" | "active" | "finished"
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      quiz_status: "waiting" | "active" | "finished"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
